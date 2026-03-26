"""
colleNameChange.py
==================
unirank.org の大学リストをスクレイピングし、前回スナップショットと比較して
追加・削除・名前変更をDiscordへ通知するスクリプト。

使い方:
  py colleNameChange.py

初回実行:
  ../CreateTable/ 内の最新 dataset_*.json からスナップショットを生成します。
  初回はスナップショット作成のみ行い、Discord通知は送信しません。

2回目以降:
  unirank.org をスクレイピングし、スナップショットと比較。
  変更があればDiscordに通知し、スナップショットを更新します。

必要パッケージ:
  pip install requests beautifulsoup4 python-dotenv
"""

import os
import re
import json
import time
import glob
import requests
from datetime import datetime
from pathlib import Path
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# ────────────────────────────────────────────────────────────
# パス設定
# ────────────────────────────────────────────────────────────

SCRIPT_DIR      = Path(__file__).parent                         # .../NotifyNameChange/
CREATE_TABLE_DIR = SCRIPT_DIR.parent / "CreateTable"            # .../CreateTable/
PROJECT_ROOT     = SCRIPT_DIR.parent.parent                     # .../willabroadjapan/
SNAPSHOT_FILE    = SCRIPT_DIR / "snapshot.json"                 # 前回状態の保存先

# .env を読み込む（プロジェクトルートにある）
load_dotenv(PROJECT_ROOT / ".env")
WEBHOOK_URL = os.environ.get("DISCORD_PYTHON_COLLEGE_NAME_CHANGED_REMOVE_ADD_NOTIFICATION_WEBHOOK", "")

# ────────────────────────────────────────────────────────────
# 対象国リスト（create_table.py の COUNTRIES と同じ）
# ────────────────────────────────────────────────────────────

COUNTRIES = {
    "アイスランド":             "https://www.unirank.org/is/a-z/",
    "アイルランド":             "https://www.unirank.org/ie/a-z/",
    "アゼルバイジャン":         "https://www.unirank.org/az/a-z/",
    "アメリカ":                 "https://www.unirank.org/us/a-z/",
    "アメリカンバージンアイランド": "https://www.unirank.org/vi/ranking/",
    "アラブ首長国連邦":         "https://www.unirank.org/ae/a-z/",
    "アルゼンチン":             "https://www.unirank.org/ar/a-z/",
    "アルバニア":               "https://www.unirank.org/al/a-z/",
    "アルメニア":               "https://www.unirank.org/am/a-z/",
    "アンドラ":                 "https://www.unirank.org/ad/ranking/",
    "イギリス":                 "https://www.unirank.org/gb/a-z/",
    "イスラエル":               "https://www.unirank.org/il/a-z/",
    "イタリア":                 "https://www.unirank.org/it/a-z/",
    "インド":                   "https://www.unirank.org/in/a-z/",
    "インドネシア":             "https://www.unirank.org/id/a-z/",
    "ウズベキスタン":           "https://www.unirank.org/uz/a-z/",
    "ウルグアイ":               "https://www.unirank.org/uy/a-z/",
    "エクアドル":               "https://www.unirank.org/ec/a-z/",
    "エジプト":                 "https://www.unirank.org/eg/a-z/",
    "エストニア":               "https://www.unirank.org/ee/a-z/",
    "オーストラリア":           "https://www.unirank.org/au/a-z/",
    "オーストリア":             "https://www.unirank.org/at/a-z/",
    "オマーン":                 "https://www.unirank.org/om/a-z/",
    "オランダ":                 "https://www.unirank.org/nl/a-z/",
    "カザフスタン":             "https://www.unirank.org/kz/a-z/",
    "カタール":                 "https://www.unirank.org/qa/a-z/",
    "カナダ":                   "https://www.unirank.org/ca/a-z/",
    "韓国":                     "https://www.unirank.org/kr/a-z/",
    "北マケドニア":             "https://www.unirank.org/mk/a-z/",
    "キプロス":                 "https://www.unirank.org/cy/a-z/",
    "キュラソー":               "https://www.unirank.org/cw/a-z/",
    "キューバ":                 "https://www.unirank.org/cu/a-z/",
    "ギリシャ":                 "https://www.unirank.org/gr/a-z/",
    "キルギス":                 "https://www.unirank.org/kg/a-z/",
    "グアテマラ":               "https://www.unirank.org/gt/a-z/",
    "グアドループ":             "https://www.unirank.org/gp/ranking/",
    "グアム":                   "https://www.unirank.org/gu/a-z/",
    "クウェート":               "https://www.unirank.org/kw/a-z/",
    "グリーンランド":           "https://www.unirank.org/gl/a-z/",
    "グレナダ":                 "https://www.unirank.org/gd/a-z/",
    "クロアチア":               "https://www.unirank.org/hr/a-z/",
    "コスタリカ":               "https://www.unirank.org/cr/a-z/",
    "コソボ":                   "https://www.unirank.org/xk/a-z/",
    "コロンビア":               "https://www.unirank.org/co/a-z/",
    "サウジアラビア":           "https://www.unirank.org/sa/a-z/",
    "サモア":                   "https://www.unirank.org/ws/a-z/",
    "サンマリノ":               "https://www.unirank.org/sm/ranking/",
    "ジョージア":               "https://www.unirank.org/ge/a-z/",
    "シンガポール":             "https://www.unirank.org/sg/a-z/",
    "スイス":                   "https://www.unirank.org/ch/a-z/",
    "スウェーデン":             "https://www.unirank.org/se/a-z/",
    "スペイン":                 "https://www.unirank.org/es/a-z/",
    "スリランカ":               "https://www.unirank.org/lk/a-z/",
    "スロバキア":               "https://www.unirank.org/sk/a-z/",
    "スロベニア":               "https://www.unirank.org/si/a-z/",
    "セルビア":                 "https://www.unirank.org/rs/",
    "タイ":                     "https://www.unirank.org/th/a-z/",
    "台湾":                     "https://www.unirank.org/tw/a-z/",
    "チェコ":                   "https://www.unirank.org/cz/a-z/",
    "中国":                     "https://www.unirank.org/cn/a-z/",
    "デンマーク":               "https://www.unirank.org/dk/a-z/",
    "ドイツ":                   "https://www.unirank.org/de/a-z/",
    "ドミニカ共和国":           "https://www.unirank.org/do/a-z/",
    "トルコ":                   "https://www.unirank.org/tr/a-z/",
    "ニューカレドニア":         "https://www.unirank.org/nc/ranking/",
    "ニュージーランド":         "https://www.unirank.org/nz/a-z/",
    "ネパール":                 "https://www.unirank.org/np/a-z/",
    "ノルウェー":               "https://www.unirank.org/no/a-z/",
    "バーレーン":               "https://www.unirank.org/bh/a-z/",
    "パナマ":                   "https://www.unirank.org/pa/a-z/",
    "パプアニューギニア":       "https://www.unirank.org/pg/a-z/",
    "パラグアイ":               "https://www.unirank.org/py/a-z/",
    "ハンガリー":               "https://www.unirank.org/hu/a-z/",
    "バングラデシュ":           "https://www.unirank.org/bd/a-z/",
    "フィジー":                 "https://www.unirank.org/fj/a-z/",
    "フィリピン":               "https://www.unirank.org/ph/a-z/",
    "フィンランド":             "https://www.unirank.org/fi/a-z/",
    "プエルトリコ":             "https://www.unirank.org/pr/a-z/",
    "ブータン":                 "https://www.unirank.org/bt/a-z/",
    "ブラジル":                 "https://www.unirank.org/br/a-z/",
    "フランス":                 "https://www.unirank.org/fr/a-z/",
    "ブルガリア":               "https://www.unirank.org/bg/a-z/",
    "ブルネイ":                 "https://www.unirank.org/bn/a-z/",
    "フレンチポリネシア":       "https://www.unirank.org/pf/ranking/",
    "ベトナム":                 "https://www.unirank.org/vn/a-z/",
    "ペルー":                   "https://www.unirank.org/pe/a-z/",
    "ベルギー":                 "https://www.unirank.org/be/a-z/",
    "ポーランド":               "https://www.unirank.org/pl/a-z/",
    "ボスニアヘルツェゴビナ":   "https://www.unirank.org/ba/a-z/",
    "ボリビア":                 "https://www.unirank.org/bo/a-z/",
    "ポルトガル":               "https://www.unirank.org/pt/a-z/",
    "香港":                     "https://www.unirank.org/hk/a-z/",
    "マカオ":                   "https://www.unirank.org/mo/a-z/",
    "マルタ":                   "https://www.unirank.org/mt/a-z/",
    "マレーシア":               "https://www.unirank.org/my/a-z/",
    "南アフリカ":               "https://www.unirank.org/za/a-z/",
    "メキシコ":                 "https://www.unirank.org/mx/a-z/",
    "モーリシャス":             "https://www.unirank.org/mu/a-z/",
    "モナコ":                   "https://www.unirank.org/mc/ranking/",
    "モルディブ":               "https://www.unirank.org/mv/ranking/",
    "モルドバ":                 "https://www.unirank.org/md/a-z/",
    "モロッコ":                 "https://www.unirank.org/ma/a-z/",
    "モンゴル":                 "https://www.unirank.org/mn/a-z/",
    "モンテネグロ":             "https://www.unirank.org/me/ranking/",
    "ラオス":                   "https://www.unirank.org/la/ranking/",
    "ラトビア":                 "https://www.unirank.org/lv/a-z/",
    "リトアニア":               "https://www.unirank.org/lt/a-z/",
    "ルーマニア":               "https://www.unirank.org/ro/a-z/",
    "ルクセンブルク":           "https://www.unirank.org/lu/a-z/",
    "レユニオン":               "https://www.unirank.org/re/a-z/",
    "ヨルダン":                 "https://www.unirank.org/jo/a-z/",
}

HEADERS_HTTP = {"User-Agent": "Mozilla/5.0 (compatible; UniversityDatasetBot/1.0)"}
GEOCODE_DELAY = 2.0   # Nominatim 利用規約：1秒以上の間隔必須

# Discord embed カラー
COLOR_ADDED   = 0x00C853   # 緑  ― 追加
COLOR_REMOVED = 0xFF1744   # 赤  ― 削除
COLOR_RENAMED = 0xFFAB00   # 黄  ― 名前変更

# ────────────────────────────────────────────────────────────
# スクレイピング（create_table.py と同じロジック）
# ────────────────────────────────────────────────────────────

def scrape_country(country_name: str, url: str) -> list[dict]:
    """unirank.org から指定国の大学一覧を取得。各要素: {大学名, 国, 都市}"""
    try:
        resp = requests.get(url, headers=HEADERS_HTTP, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"  [WARN] {country_name} スクレイピング失敗: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    universities = []
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        a_tag = tds[1].find("a")
        if not a_tag:
            continue
        name = a_tag.get_text(strip=True)
        city = tds[2].get_text(strip=True)
        if name:
            universities.append({"大学名": name, "国": country_name, "都市": city})
    return universities


def scrape_all() -> list[dict]:
    """全対象国をスクレイピングして大学リストを返す。"""
    all_unis = []
    total = len(COUNTRIES)
    for idx, (country, url) in enumerate(COUNTRIES.items(), 1):
        print(f"  [{idx:>3}/{total}] {country}...", end=" ", flush=True)
        unis = scrape_country(country, url)
        print(f"{len(unis)}大学")
        all_unis.extend(unis)
        time.sleep(1.0)  # サーバー負荷軽減
    return all_unis


# ────────────────────────────────────────────────────────────
# ジオコーディング（Nominatim）
# ────────────────────────────────────────────────────────────

def geocode(name: str, city: str, country: str) -> tuple[float | None, float | None]:
    """大学名・都市・国から緯度経度を返す。取得失敗時は (None, None)。"""
    base_url = "https://nominatim.openstreetmap.org/search"
    queries = [
        f"{name}, {city}, {country}",
        name,
    ]
    for query in queries:
        try:
            resp = requests.get(
                base_url,
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": "ColleNameChangeBot/1.0 (study-abroad-db)"},
                timeout=15,
            )
            if resp.status_code == 429:
                print(f"    [429] レート制限 — 60秒待機...")
                time.sleep(60)
                continue
            data = resp.json()
            if data:
                time.sleep(GEOCODE_DELAY)
                return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            pass
        time.sleep(GEOCODE_DELAY)
    return None, None


# ────────────────────────────────────────────────────────────
# スナップショット管理
# ────────────────────────────────────────────────────────────

def load_snapshot() -> list[dict] | None:
    """スナップショットが存在すれば読み込む。なければ None を返す。"""
    if not SNAPSHOT_FILE.exists():
        return None
    with open(SNAPSHOT_FILE, encoding="utf-8") as f:
        return json.load(f)


def save_snapshot(universities: list[dict]) -> None:
    """現在の大学リストをスナップショットとして保存する。"""
    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(universities, f, ensure_ascii=False, indent=2)
    print(f"  スナップショット保存: {SNAPSHOT_FILE} ({len(universities)}大学)")


def seed_snapshot_from_latest_json() -> list[dict] | None:
    """
    CreateTable/ ディレクトリの最新 dataset_*.json から
    スナップショットを初期化する。ファイルがなければ None を返す。
    """
    pattern = str(CREATE_TABLE_DIR / "dataset_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        return None

    latest = files[-1]
    print(f"  既存JSONから初期化: {Path(latest).name}")
    with open(latest, encoding="utf-8") as f:
        data = json.load(f)

    # JSON内の各行から必要フィールドだけ抽出
    snapshot = []
    for row in data:
        entry = {
            "大学名": row.get("大学名", ""),
            "国":     row.get("国", ""),
            "都市":   row.get("都市", ""),
            "緯度":   row.get("緯度"),
            "経度":   row.get("経度"),
        }
        if entry["大学名"]:
            snapshot.append(entry)
    return snapshot


# ────────────────────────────────────────────────────────────
# 変更検出
# ────────────────────────────────────────────────────────────

def build_key(uni: dict) -> str:
    """(大学名, 国) を正規化したキー。比較に使用。"""
    return f"{uni['大学名'].strip()}|{uni['国'].strip()}"


def detect_changes(old_list: list[dict], new_list: list[dict]) -> dict:
    """
    追加・削除・名前変更を検出する。

    名前変更の判定:
      同じ (国, 都市) で old に存在した大学が消え、new に別名の大学が現れた場合、
      その組み合わせが 1対1 なら「名前変更」として扱う。

    Returns:
      {
        "added":   [{"大学名", "国", "都市"}, ...],
        "removed": [{"大学名", "国", "都市", "緯度", "経度"}, ...],
        "renamed": [{"旧大学名", "新大学名", "国", "都市", "緯度", "経度"}, ...],
      }
    """
    old_map = {build_key(u): u for u in old_list}
    new_map = {build_key(u): u for u in new_list}

    old_keys = set(old_map.keys())
    new_keys = set(new_map.keys())

    raw_removed_keys = old_keys - new_keys   # 旧にあって新にない
    raw_added_keys   = new_keys - old_keys   # 新にあって旧にない

    raw_removed = [old_map[k] for k in raw_removed_keys]
    raw_added   = [new_map[k] for k in raw_added_keys]

    # ── 名前変更の検出 ────────────────────────────────────────
    # 同じ (国, 都市) で removed 1件 + added 1件 → 名前変更候補
    def loc_key(u: dict) -> str:
        return f"{u['国']}|{u.get('都市', '')}"

    removed_by_loc: dict[str, list] = {}
    for u in raw_removed:
        removed_by_loc.setdefault(loc_key(u), []).append(u)

    added_by_loc: dict[str, list] = {}
    for u in raw_added:
        added_by_loc.setdefault(loc_key(u), []).append(u)

    renamed   = []
    confirmed_removed_keys = set()
    confirmed_added_keys   = set()

    for lk in set(removed_by_loc.keys()) & set(added_by_loc.keys()):
        r_list = removed_by_loc[lk]
        a_list = added_by_loc[lk]
        if len(r_list) == 1 and len(a_list) == 1:
            old_uni = r_list[0]
            new_uni = a_list[0]
            renamed.append({
                "旧大学名": old_uni["大学名"],
                "新大学名": new_uni["大学名"],
                "国":       old_uni["国"],
                "都市":     old_uni.get("都市", ""),
                "緯度":     old_uni.get("緯度"),
                "経度":     old_uni.get("経度"),
            })
            confirmed_removed_keys.add(build_key(old_uni))
            confirmed_added_keys.add(build_key(new_uni))

    # 名前変更と判定されなかったものが純粋な追加・削除
    truly_removed = [u for u in raw_removed if build_key(u) not in confirmed_removed_keys]
    truly_added   = [u for u in raw_added   if build_key(u) not in confirmed_added_keys]

    return {
        "added":   truly_added,
        "removed": truly_removed,
        "renamed": renamed,
    }


# ────────────────────────────────────────────────────────────
# Discord通知
# ────────────────────────────────────────────────────────────

def _lat_lon_str(lat, lon) -> str:
    """緯度経度を表示用文字列に変換。取得できていない場合は「取得中」。"""
    if lat is not None and lon is not None:
        return f"{lat:.4f}, {lon:.4f}"
    return "取得中"


def _send_embed(embed: dict) -> bool:
    """Discord Webhook に embed を1件送信する。成功で True。"""
    if not WEBHOOK_URL:
        print("  [WARN] DISCORD_PYTHON_COLLEGE_NAME_CHANGED_REMOVE_ADD_NOTIFICATION_WEBHOOK が未設定です")
        return False
    try:
        resp = requests.post(
            WEBHOOK_URL,
            json={"embeds": [embed]},
            timeout=15,
        )
        if resp.status_code in (200, 204):
            return True
        print(f"  [WARN] Discord送信失敗: HTTP {resp.status_code} — {resp.text[:200]}")
        return False
    except Exception as e:
        print(f"  [ERROR] Discord送信例外: {e}")
        return False


def notify_added(uni: dict) -> None:
    """追加大学を通知する。"""
    lat, lon = uni.get("緯度"), uni.get("経度")
    embed = {
        "title": "🆕  大学追加",
        "color": COLOR_ADDED,
        "fields": [
            {"name": "大学名", "value": uni["大学名"],             "inline": False},
            {"name": "国",     "value": uni["国"],                 "inline": True},
            {"name": "都市",   "value": uni.get("都市") or "不明", "inline": True},
            {"name": "緯度・経度", "value": _lat_lon_str(lat, lon), "inline": False},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    _send_embed(embed)
    time.sleep(1.0)  # Discord レート制限対策


def notify_removed(uni: dict) -> None:
    """削除（廃校・統合）大学を通知する。"""
    lat, lon = uni.get("緯度"), uni.get("経度")
    embed = {
        "title": "🚫  大学削除（廃校・統合）",
        "color": COLOR_REMOVED,
        "fields": [
            {"name": "大学名", "value": uni["大学名"],             "inline": False},
            {"name": "国",     "value": uni["国"],                 "inline": True},
            {"name": "都市",   "value": uni.get("都市") or "不明", "inline": True},
            {"name": "緯度・経度", "value": _lat_lon_str(lat, lon), "inline": False},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    _send_embed(embed)
    time.sleep(1.0)


def notify_renamed(change: dict) -> None:
    """名前変更を通知する。"""
    lat, lon = change.get("緯度"), change.get("経度")
    embed = {
        "title": "✏️  大学名変更",
        "color": COLOR_RENAMED,
        "fields": [
            {"name": "旧大学名", "value": change["旧大学名"],          "inline": False},
            {"name": "新大学名", "value": change["新大学名"],          "inline": False},
            {"name": "国",       "value": change["国"],                "inline": True},
            {"name": "都市",     "value": change.get("都市") or "不明", "inline": True},
            {"name": "緯度・経度", "value": _lat_lon_str(lat, lon),    "inline": False},
        ],
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    _send_embed(embed)
    time.sleep(1.0)


def notify_summary(added: int, removed: int, renamed: int) -> None:
    """変更がなかった場合または処理完了後のサマリーを通知する。"""
    if added == 0 and removed == 0 and renamed == 0:
        embed = {
            "title": "✅  大学リスト確認完了",
            "description": "変更はありませんでした。",
            "color": 0x607D8B,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    else:
        lines = []
        if added:   lines.append(f"🆕 追加: **{added}件**")
        if removed: lines.append(f"🚫 削除: **{removed}件**")
        if renamed: lines.append(f"✏️ 名前変更: **{renamed}件**")
        embed = {
            "title": "📋  大学リスト変更サマリー",
            "description": "\n".join(lines),
            "color": 0x29B6F6,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
    _send_embed(embed)


# ────────────────────────────────────────────────────────────
# メイン処理
# ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  大学名変更チェッカー")
    print(f"  実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── STEP 1: スナップショット読み込み ──────────────────────
    print("\n[STEP 1] スナップショット読み込み...")
    snapshot = load_snapshot()

    if snapshot is None:
        # 初回実行: CreateTable/ の最新JSONからシード
        print("  スナップショットが見つかりません。初回セットアップを行います。")
        snapshot = seed_snapshot_from_latest_json()

        if snapshot is None:
            # JSONもない場合は今すぐスクレイピングして初期スナップショット作成
            print("  既存JSONもありません。スクレイピングして初期スナップショットを作成します...")
            fresh = scrape_all()
            # ジオコーディングは初回はスキップ（時間がかかるため）
            save_snapshot(fresh)
            print("\n  ✅ 初期スナップショット作成完了。次回実行時から変更通知が有効になります。")
            return
        else:
            save_snapshot(snapshot)
            print("\n  ✅ 初期スナップショット作成完了。次回実行時から変更通知が有効になります。")
            return

    print(f"  スナップショット: {len(snapshot)}大学")

    # ── STEP 2: 最新データをスクレイピング ───────────────────
    print("\n[STEP 2] unirank.org からスクレイピング中...")
    fresh_list = scrape_all()
    print(f"  取得完了: {len(fresh_list)}大学")

    # ── STEP 3: 変更検出 ──────────────────────────────────────
    print("\n[STEP 3] 変更検出中...")
    changes = detect_changes(snapshot, fresh_list)

    added_list   = changes["added"]
    removed_list = changes["removed"]
    renamed_list = changes["renamed"]

    print(f"  追加: {len(added_list)}件  削除: {len(removed_list)}件  名前変更: {len(renamed_list)}件")

    # ── STEP 4: 追加大学のジオコーディング ───────────────────
    if added_list:
        print(f"\n[STEP 4] 追加大学 {len(added_list)}件 のジオコーディング...")
        for i, uni in enumerate(added_list, 1):
            print(f"  [{i}/{len(added_list)}] {uni['大学名']}...")
            lat, lon = geocode(uni["大学名"], uni.get("都市", ""), uni["国"])
            uni["緯度"] = lat
            uni["経度"] = lon
            if lat:
                print(f"    → {lat:.4f}, {lon:.4f}")
            else:
                print(f"    → 取得不可")

    # ── STEP 5: Discord通知 ───────────────────────────────────
    print("\n[STEP 5] Discord通知送信中...")

    for uni in removed_list:
        print(f"  🚫 削除通知: {uni['大学名']} ({uni['国']})")
        notify_removed(uni)

    for change in renamed_list:
        print(f"  ✏️  名前変更通知: {change['旧大学名']} → {change['新大学名']} ({change['国']})")
        notify_renamed(change)

    for uni in added_list:
        print(f"  🆕 追加通知: {uni['大学名']} ({uni['国']})")
        notify_added(uni)

    # サマリー通知
    notify_summary(len(added_list), len(removed_list), len(renamed_list))

    # ── STEP 6: スナップショット更新 ─────────────────────────
    print("\n[STEP 6] スナップショット更新...")

    # 新しいスナップショット = (旧スナップショット - 削除 - 名前変更の旧) + 名前変更の新 + 追加
    removed_keys = {build_key(u) for u in removed_list}
    renamed_old_keys = {build_key({"大学名": r["旧大学名"], "国": r["国"]}) for r in renamed_list}
    exclude_keys = removed_keys | renamed_old_keys

    # 旧スナップショットから除外対象を取り除く（既存の緯度経度を保持）
    new_snapshot = [u for u in snapshot if build_key(u) not in exclude_keys]

    # 名前変更後の新エントリを追加（旧の緯度経度を引き継ぐ）
    for r in renamed_list:
        new_snapshot.append({
            "大学名": r["新大学名"],
            "国":     r["国"],
            "都市":   r["都市"],
            "緯度":   r.get("緯度"),
            "経度":   r.get("経度"),
        })

    # 新規追加分を追加（ジオコーディング済み）
    for uni in added_list:
        new_snapshot.append({
            "大学名": uni["大学名"],
            "国":     uni["国"],
            "都市":   uni.get("都市", ""),
            "緯度":   uni.get("緯度"),
            "経度":   uni.get("経度"),
        })

    save_snapshot(new_snapshot)

    print("\n" + "=" * 60)
    print(f"  ✅ 完了  追加:{len(added_list)}  削除:{len(removed_list)}  名前変更:{len(renamed_list)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
