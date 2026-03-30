"""
url_checker.py  ―  大学 URL 死活チェック
==========================================
dataset_*.csv の URL 列をチェックし、
アクセス不能な URL を Discord に通知する。

処理の流れ:
  1. 最新の dataset_*.csv を読み込む
  2. URL が記入済みの行をすべて university_urls.json にバックアップ保存
  3. 各 URL に HTTP リクエストを送り、エラーなら Discord 通知
     ・空欄の URL は完全に無視（通知しない）
     ・4xx / 5xx / 接続エラー / タイムアウト → 通知対象
     ・リダイレクト（301/302）は正常として扱う

使い方:
  python url_checker.py              # 全 URL をチェック
  python url_checker.py --backup-only  # JSON 保存のみ（チェックなし）

出力:
  university_urls.json  ← 次回テーブル再構築時に URL を自動補完

依存:
  pip install requests python-dotenv
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── 設定 ──────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent.parent / ".env")   # プロジェクトルートの .env

HERE     = Path(__file__).parent
WEBHOOK  = os.getenv("DISCORD_URL_REMOVE_WEBHOOK", "")
URL_JSON = HERE / "university_urls.json"

REQUEST_TIMEOUT = 12    # 秒
RETRY_COUNT     = 1     # リトライ回数（失敗時）
SLEEP_BETWEEN   = 1.2   # リクエスト間隔（秒）
DISCORD_SLEEP   = 0.6   # Discord 通知間隔（秒）

# 通知対象のステータスコード
BAD_CODES = set(range(400, 600))   # 4xx / 5xx すべて
# ただし 429（Too Many Requests）は別メッセージで通知
RATE_LIMIT_CODE = 429

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


# ── CSV ユーティリティ ────────────────────────────────────────

def find_latest_csv() -> Path | None:
    files = sorted(HERE.glob("dataset_*.csv"), reverse=True)
    return files[0] if files else None


def load_urls_from_csv(csv_path: Path) -> list[dict]:
    """CSV から URL が記入済みの行だけ抽出して返す。"""
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    url_rows = []
    for r in rows:
        url = r.get("URL", "").strip()
        if url:
            url_rows.append({
                "大学名": r.get("大学名", "").strip(),
                "国":     r.get("国", "").strip(),
                "都市":   r.get("都市", "").strip(),
                "URL":    url,
            })
    return url_rows


# ── JSON バックアップ ─────────────────────────────────────────

def save_url_backup(url_rows: list[dict]):
    """
    university_urls.json を保存する。
    形式: { "大学名": "https://..." }
    create_table.py の STEP 3f で自動的に読み込まれ URL 列に補完される。
    """
    url_map = {r["大学名"]: r["URL"] for r in url_rows if r["大学名"]}
    with open(URL_JSON, "w", encoding="utf-8") as f:
        json.dump(url_map, f, ensure_ascii=False, indent=2, sort_keys=True)
    return url_map


# ── HTTP チェック ─────────────────────────────────────────────

def check_url(url: str) -> tuple[int | None, str]:
    """
    URL をチェックして (status_code, error_msg) を返す。
    正常: (200, "")  / HTTPエラー: (403, "")  / 接続失敗: (None, "メッセージ")
    """
    for attempt in range(RETRY_COUNT + 1):
        try:
            r = requests.get(
                url,
                headers=HEADERS,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            return r.status_code, ""

        except requests.exceptions.SSLError:
            return None, "SSL エラー"
        except requests.exceptions.ConnectionError:
            if attempt < RETRY_COUNT:
                time.sleep(3)
                continue
            return None, "接続エラー（DNS / タイムアウト）"
        except requests.exceptions.Timeout:
            if attempt < RETRY_COUNT:
                time.sleep(3)
                continue
            return None, f"タイムアウト（{REQUEST_TIMEOUT}s）"
        except requests.exceptions.TooManyRedirects:
            return None, "リダイレクトループ"
        except Exception as e:
            return None, str(e)[:120]

    return None, "不明なエラー"


# ── Discord 通知 ──────────────────────────────────────────────

def send_discord(entry: dict):
    """壊れた URL を Discord に通知する。"""
    if not WEBHOOK:
        print("    ⚠  DISCORD_URL_REMOVE_WEBHOOK が .env に未設定 → 通知スキップ")
        return

    status = entry.get("status")
    error  = entry.get("error", "")
    uni    = entry.get("大学名", "")
    url    = entry.get("URL", "")
    country = entry.get("国", "不明")
    city    = entry.get("都市", "")

    # ステータス別メッセージ
    if status == 404:
        reason = "404 Not Found — ページが存在しません"
        color  = 0xFF4444
    elif status == 403:
        reason = "403 Forbidden — アクセス拒否（URL変更の可能性）"
        color  = 0xFF8C00
    elif status == 410:
        reason = "410 Gone — ページが恒久的に削除されました"
        color  = 0xFF0000
    elif status == RATE_LIMIT_CODE:
        reason = "429 Too Many Requests — 一時的なレート制限（再確認推奨）"
        color  = 0xFFCC00
    elif status and status >= 500:
        reason = f"{status} Server Error — サーバー側エラー（一時的かも）"
        color  = 0xFF6B6B
    elif status and status >= 400:
        reason = f"{status} Client Error"
        color  = 0xFF8C00
    else:
        reason = f"接続失敗 — {error}"
        color  = 0x999999

    location = f"{country}・{city}" if city else country

    payload = {
        "embeds": [{
            "title": "🔴 大学 URL が応答しません",
            "color": color,
            "fields": [
                {"name": "大学名",   "value": uni,      "inline": False},
                {"name": "所在地",   "value": location, "inline": True},
                {"name": "ステータス", "value": reason,  "inline": False},
                {"name": "URL",      "value": f"[{url}]({url})", "inline": False},
            ],
            "footer": {
                "text": f"url_checker.py  •  {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            },
        }]
    }

    try:
        r = requests.post(WEBHOOK, json=payload, timeout=10)
        if r.status_code not in (200, 204):
            print(f"    ⚠  Discord 送信失敗: HTTP {r.status_code}")
    except Exception as e:
        print(f"    ⚠  Discord 通信エラー: {e}")

    time.sleep(DISCORD_SLEEP)


# ── メイン ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="大学 URL 死活チェック")
    parser.add_argument("--backup-only", action="store_true",
                        help="HTTP チェックをせず JSON 保存のみ実行する")
    args = parser.parse_args()

    print("=" * 60)
    print("  大学 URL チェッカー")
    print("=" * 60)

    # CSV 読み込み
    csv_path = find_latest_csv()
    if not csv_path:
        print("❌  dataset_*.csv が見つかりません")
        print(f"    対象フォルダ: {HERE}")
        sys.exit(1)

    print(f"\n📋  CSV: {csv_path.name}")
    url_rows = load_urls_from_csv(csv_path)
    print(f"    URL 記入済み: {len(url_rows)} 件")

    if not url_rows:
        print("    URL が1件も記入されていません。終了します。")
        sys.exit(0)

    # JSON バックアップ保存（常に実行）
    url_map = save_url_backup(url_rows)
    print(f"    ✅  university_urls.json に {len(url_map)} 件の URL を保存しました")
    print(f"       → create_table.py 実行時に STEP 3f で自動補完されます")

    if args.backup_only:
        print("\n--backup-only モード: HTTP チェックをスキップします")
        print("=" * 60)
        return

    # HTTP チェック
    if not WEBHOOK:
        print(
            "\n⚠  DISCORD_URL_REMOVE_WEBHOOK が .env に設定されていません\n"
            "   チェックは実行しますが Discord 通知はスキップします\n"
        )

    print(f"\n🔍  HTTP チェック開始 ({len(url_rows)} 件)...\n")

    broken  = []
    ok      = 0

    for i, entry in enumerate(url_rows, 1):
        name = entry["大学名"]
        url  = entry["URL"]
        prefix = f"  [{i:4d}/{len(url_rows)}]"

        # 長い大学名は省略表示
        display = name[:38] + ".." if len(name) > 40 else name
        print(f"{prefix} {display:<40s}", end="  ", flush=True)

        status, error = check_url(url)

        # 判定
        if status is not None and status < 400:
            # 正常（2xx / 3xx）
            print(f"✅  {status}")
            ok += 1
        else:
            reason = str(status) if status else error
            print(f"❌  {reason}")
            broken_entry = {**entry, "status": status, "error": error}
            broken.append(broken_entry)
            send_discord(broken_entry)

        time.sleep(SLEEP_BETWEEN)

    # サマリー
    print(f"\n{'=' * 60}")
    print(f"  チェック完了")
    print(f"  正常:   {ok} 件")
    print(f"  エラー: {len(broken)} 件")
    if broken:
        print(f"\n  エラー一覧:")
        for b in broken:
            reason = str(b['status']) if b['status'] else b['error']
            print(f"    [{reason:>3}]  {b['大学名']}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
