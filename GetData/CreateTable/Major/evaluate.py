"""
evaluate.py  ―  CDS 専攻割合パーサー
======================================
Common Data Set の専攻割合テーブルを貼り付けると
  ・各カテゴリの Bachelor's 割合を自動解析
  ・8% 以上のカテゴリを TRUE にセット
  ・../dataset_YYYY_MM_DD.csv（最新）の該当大学行を上書き保存

【貼り付け形式への対応】
  ・タブ区切り（HTML テーブルをそのままコピー）
      → Category / Diploma / Associate / Bachelor's / CIP の列構成を自動検出
  ・スペース区切り（PDF / テキストコピー）
      → "% 付き数値" を Bachelor's 値として取得、末尾 CIP コードは除外

使い方:
  python evaluate.py
  → ブラウザで http://localhost:5050 を開く

依存:
  pip install flask
"""

import csv
import re
from pathlib import Path
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# ── パス設定 ──────────────────────────────────────────────
HERE      = Path(__file__).parent      # .../Major/
PARENT    = HERE.parent                # .../CreateTable/
THRESHOLD = 8.0                        # TRUE にする閾値(%)

# ── 38 カテゴリ（create_table.py と完全一致・順番通り）────
CATEGORIES = [
    "Agriculture",
    "Natural resources and conservation",
    "Architecture",
    "Area, ethnic, and gender studies",
    "Communication/journalism",
    "Communication technologies",
    "Computer and information sciences",
    "Personal and culinary services",
    "Education",
    "Engineering",
    "Engineering technologies",
    "Foreign languages, literatures, and linguistics",
    "Family and consumer sciences",
    "Law/legal studies",
    "English",
    "Liberal arts/general studies",
    "Library science",
    "Biological/life sciences",
    "Mathematics and statistics",
    "Military science and military technologies",
    "Interdisciplinary studies",
    "Parks and recreation",
    "Philosophy and religious studies",
    "Theology and religious vocations",
    "Physical sciences",
    "Science technologies",
    "Psychology",
    "Homeland Security, law enforcement, firefighting, and protective services",
    "Public administration and social services",
    "Social sciences",
    "Construction trades",
    "Mechanic and repair technologies",
    "Precision production",
    "Transportation and materials moving",
    "Visual and performing arts",
    "Health professions and related programs",
    "Business/marketing",
    "History",
]

# ── 照合キー（先頭 25 文字、小文字化）────────────────────
_CAT_KEYS = [c.lower()[:25] for c in CATEGORIES]


def _match_category(text: str) -> int | None:
    """テキストがどのカテゴリに対応するか返す（インデックス）。"""
    t = text.lower().strip()
    for i, key in enumerate(_CAT_KEYS):
        if t.startswith(key) or key.startswith(t[:25]):
            return i
    return None


def _extract_pct(cell: str) -> float:
    """セル文字列から数値を取り出す（% 付き・なし両対応）。"""
    cell = cell.strip()
    if not cell:
        return 0.0
    m = re.search(r"([\d]+(?:\.\d+)?)\s*%?", cell)
    return float(m.group(1)) if m else 0.0


# ── メイン解析ロジック ────────────────────────────────────

def parse_pasted(raw: str) -> dict:
    """
    貼り付けテキストから 38 カテゴリの Bachelor's 割合を抽出する。

    ① タブ区切り形式（HTML テーブルをそのままコピー）
       列構成: [Category] [Diploma] [Associate] [Bachelor's] [CIP]
       → Bachelor's 列（index=3）を使用

    ② スペース区切り形式（PDF・プレーンテキストのコピー）
       各行: "カテゴリ名  [値%]  [CIPコード]"
       → % 付き数値を使用。末尾 CIP コード（1〜2桁）は除外
    """
    lines = raw.strip().splitlines()

    # ── ヘッダー・フッター行を除去 ──────────────────────
    skip_patterns = re.compile(
        r"^(category|diploma|associate|bachelor|cip|other|total|to include)",
        re.I,
    )
    lines = [l for l in lines if l.strip() and not skip_patterns.match(l.strip())]

    values: dict[str, float] = {cat: 0.0 for cat in CATEGORIES}

    # ── ① タブ区切り検出 ────────────────────────────────
    tab_count = sum(1 for l in lines if "\t" in l)
    use_tabs  = tab_count >= max(1, len(lines) * 0.3)

    if use_tabs:
        # タブで分割し、複数行にまたがるカテゴリ名を結合する
        # 例: "Homeland Security, ..." が 2 行に折り返される場合
        records: list[list[str]] = []
        for line in lines:
            if "\t" in line:
                records.append(line.split("\t"))
            else:
                # タブなし = 直前レコードのカテゴリ名の続き
                if records:
                    records[-1][0] = records[-1][0] + " " + line.strip()

        for parts in records:
            cat_text = parts[0].strip()
            # Bachelor's は 4 列目（index=3）
            # 列が足りない場合は 0
            bachelor_cell = parts[3].strip() if len(parts) > 3 else ""
            val = _extract_pct(bachelor_cell)

            idx = _match_category(cat_text)
            if idx is not None:
                values[CATEGORIES[idx]] = val

    else:
        # ── ② スペース区切り ─────────────────────────────
        # 複数行折り返し（Homeland Security...）の対応:
        # 直前にマッチしたカテゴリが確定していない状態で
        # 次行がカテゴリにマッチしなければ連結して再試行
        pending_text = ""
        pending_idx  = None

        def flush_pending(text, idx, val_str):
            v = _extract_pct(val_str)
            if idx is not None:
                values[CATEGORIES[idx]] = v

        for line in lines:
            # 末尾の CIP コード（" 43" / " 28 & 29" など）を除去
            cleaned = re.sub(r"\s+\d{1,2}(?:\s*&\s*\d{1,2})?\s*$", "", line.strip())

            # % 付き数値を抽出（値なし → ""）
            pct_m   = re.search(r"([\d]+(?:\.\d+)?)\s*%", cleaned)
            val_str = pct_m.group(0) if pct_m else ""

            # カテゴリ名部分（数値・% を除いた先頭テキスト）
            cat_text = re.sub(r"[\d.]+\s*%?", "", cleaned).strip().rstrip(",")

            idx = _match_category(cat_text)

            if idx is None and pending_text:
                # 前行と連結して再試行（折り返し行）
                combined = pending_text + " " + cat_text
                idx2 = _match_category(combined)
                if idx2 is not None:
                    values[CATEGORIES[idx2]] = _extract_pct(val_str)
                    pending_text = ""
                    pending_idx  = None
                    continue
                # それでもマッチしなければ pending を確定して次へ
                if pending_idx is not None:
                    values[CATEGORIES[pending_idx]] = 0.0
                pending_text = ""
                pending_idx  = None

            if idx is not None:
                values[CATEGORIES[idx]] = _extract_pct(val_str)
                pending_text = ""
                pending_idx  = None
            else:
                # マッチ保留（次行と結合するかも）
                pending_text = cat_text
                pending_idx  = None

    # ── 小数形式（0.xx）を % に変換 ──────────────────────
    total = sum(values.values())
    if 0.5 <= total <= 1.5:
        values = {k: round(v * 100, 2) for k, v in values.items()}

    return {cat: round(values[cat], 2) for cat in CATEGORIES}


# ── CSV ユーティリティ ────────────────────────────────────

def find_latest_csv() -> Path | None:
    files = sorted(PARENT.glob("dataset_*.csv"), reverse=True)
    return files[0] if files else None


def read_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader    = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows       = list(reader)
    return fieldnames, rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


# ── HTML テンプレート ─────────────────────────────────────

HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CDS Major Evaluator</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;700;800&display=swap');

  :root {
    --bg:      #0d0f14;
    --surface: #161920;
    --border:  #252830;
    --accent:  #5bffc8;
    --accent2: #ff6b6b;
    --text:    #e8eaf0;
    --muted:   #6b7280;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
    padding: 2rem;
  }

  header { margin-bottom: 2.5rem; }
  header h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.8rem;
    letter-spacing: -0.02em;
    color: var(--accent);
  }
  header p { color: var(--muted); font-size: 0.78rem; margin-top: 0.3rem; }

  .layout { display: grid; grid-template-columns: 380px 1fr; gap: 1.5rem; align-items: start; }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.5rem;
  }

  label {
    display: block;
    font-size: 0.72rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
  }

  input[type="text"], textarea {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.82rem;
    padding: 0.6rem 0.8rem;
    outline: none;
    transition: border-color 0.15s;
  }
  input[type="text"]:focus, textarea:focus { border-color: var(--accent); }
  textarea { resize: vertical; min-height: 280px; line-height: 1.5; }

  .hint { font-size: 0.7rem; color: var(--muted); margin-top: 0.35rem; line-height: 1.6; }

  .format-badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    margin-right: 0.3rem;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
  }
  .badge-tab  { background: rgba(91,255,200,0.15); color: var(--accent); border: 1px solid rgba(91,255,200,0.35); }
  .badge-text { background: rgba(255,200,91,0.15);  color: #ffc85b;       border: 1px solid rgba(255,200,91,0.35); }

  button#parseBtn {
    margin-top: 1.2rem;
    width: 100%;
    padding: 0.75rem;
    background: var(--accent);
    color: #0d0f14;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.9rem;
    letter-spacing: 0.04em;
    border: none;
    border-radius: 7px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  button#parseBtn:hover  { opacity: 0.88; }
  button#parseBtn:active { transform: scale(0.98); }

  button#saveBtn {
    margin-top: 0.8rem;
    width: 100%;
    padding: 0.65rem;
    background: transparent;
    color: var(--accent);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.85rem;
    border: 1px solid var(--accent);
    border-radius: 7px;
    cursor: pointer;
    transition: background 0.15s;
    display: none;
  }
  button#saveBtn:hover { background: rgba(91,255,200,0.08); }

  #status {
    margin-top: 0.8rem;
    font-size: 0.75rem;
    min-height: 1.2rem;
    color: var(--accent);
  }
  #status.err { color: var(--accent2); }

  /* Result table */
  .result-panel { overflow-y: auto; max-height: 88vh; }

  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  thead th {
    position: sticky; top: 0;
    background: var(--surface);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    padding: 0.6rem 0.8rem;
    border-bottom: 1px solid var(--border);
    text-align: left;
  }
  thead th:last-child { text-align: center; }

  tbody tr { border-bottom: 1px solid #1a1d24; transition: background 0.1s; }
  tbody tr:hover { background: #1a1d24; }
  tbody tr.true-row { background: rgba(91,255,200,0.04); }

  td { padding: 0.5rem 0.8rem; }
  td.pct {
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--muted);
    min-width: 70px;
  }
  td.pct.hi { color: var(--accent); font-weight: 500; }
  td.bar { width: 130px; }
  td.check { text-align: center; }

  .bar-wrap { background: #1a1d24; border-radius: 3px; height: 6px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; background: #2a3540; transition: width 0.4s ease; }
  .bar-fill.hi { background: var(--accent); }

  .badge-true {
    display: inline-block;
    background: rgba(91,255,200,0.15);
    color: var(--accent);
    border: 1px solid rgba(91,255,200,0.4);
    border-radius: 4px;
    font-size: 0.68rem;
    padding: 0.15rem 0.5rem;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .badge-false { color: #2e3240; font-size: 0.68rem; }

  .total-row td {
    border-top: 1px solid var(--border);
    font-weight: 500;
    color: var(--accent);
    font-family: 'Syne', sans-serif;
  }

  .summary-bar {
    display: flex;
    gap: 1.2rem;
    margin-bottom: 1rem;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .summary-bar span { color: var(--text); font-weight: 500; }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: var(--muted);
    font-size: 0.78rem;
    gap: 0.5rem;
    text-align: center;
  }
  .empty-state .big { font-size: 2.5rem; opacity: 0.3; }
</style>
</head>
<body>

<header>
  <h1>CDS Major Evaluator</h1>
  <p>Common Data Set の専攻割合テーブルをコピペ → Bachelor's 8% 以上を TRUE に判定</p>
</header>

<div class="layout">

  <!-- 左パネル: 入力 -->
  <div class="panel">
    <div style="margin-bottom:1.2rem;">
      <label>大学名（CSV の大学名と完全一致）</label>
      <input type="text" id="uniName" placeholder="例: Harvard University">
    </div>

    <div>
      <label>CDS 専攻割合テーブル（コピペ）</label>
      <textarea id="rawData"
        placeholder="HTML テーブルをそのままコピーしてください。

【タブ区切り形式】例:
Agriculture		 		01
Natural resources…		2.75%	03

【テキスト形式】例:
Agriculture 01
Natural resources and conservation 2.75% 03
…

・「Other」「TOTAL」行は自動除外
・CIP コード末尾数字は自動除去
・合計が 1.0 前後の場合は ×100 変換"></textarea>
      <p class="hint">
        <span class="format-badge badge-tab">TAB</span> HTML テーブルのそのままコピーに対応<br>
        <span class="format-badge badge-text">TEXT</span> PDF・プレーンテキストのコピーに対応
      </p>
    </div>

    <button id="parseBtn" onclick="parseData()">解析する</button>
    <button id="saveBtn" onclick="saveToCSV()">CSV に保存（大学名で上書き）</button>
    <div id="status"></div>
  </div>

  <!-- 右パネル: 結果 -->
  <div class="panel result-panel" id="resultPanel">
    <div class="empty-state">
      <div class="big">📋</div>
      <div>左のパネルにデータを貼り付けて<br>「解析する」を押してください</div>
    </div>
  </div>

</div>

<script>
let lastResult = null;

async function parseData() {
  const raw    = document.getElementById('rawData').value.trim();
  const status = document.getElementById('status');
  if (!raw) { setStatus('テキストを貼り付けてください', true); return; }

  setStatus('解析中...', false);
  try {
    const res  = await fetch('/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const data = await res.json();
    if (data.error) { setStatus(data.error, true); return; }

    lastResult = data;
    renderTable(data);

    const uniName = document.getElementById('uniName').value.trim();
    document.getElementById('saveBtn').style.display = uniName ? 'block' : 'none';
    setStatus(
      `✓ 解析完了 — 合計 ${data.total.toFixed(1)}%  /  TRUE（8%超）: ${data.above_threshold} カテゴリ`,
      false
    );
  } catch (e) {
    setStatus('通信エラー: ' + e.message, true);
  }
}

async function saveToCSV() {
  if (!lastResult) return;
  const uniName = document.getElementById('uniName').value.trim();
  if (!uniName) { setStatus('大学名を入力してください', true); return; }

  setStatus('保存中...', false);
  const res  = await fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uni_name: uniName, values: lastResult.values }),
  });
  const data = await res.json();
  if (data.error) setStatus('⚠ ' + data.error, true);
  else            setStatus('✅ ' + data.message, false);
}

function renderTable(data) {
  const maxPct = Math.max(...Object.values(data.values), 1);

  let rows = '';
  for (const [cat, pct] of Object.entries(data.values)) {
    const hi   = pct >= {{ threshold }};
    const barW = Math.round((pct / maxPct) * 100);
    rows += `
      <tr class="${hi ? 'true-row' : ''}">
        <td>${cat}</td>
        <td class="pct ${hi ? 'hi' : ''}">${pct > 0 ? pct.toFixed(2) + '%' : '—'}</td>
        <td class="bar">
          <div class="bar-wrap">
            <div class="bar-fill ${hi ? 'hi' : ''}" style="width:${barW}%"></div>
          </div>
        </td>
        <td class="check">
          ${hi
            ? '<span class="badge-true">TRUE</span>'
            : '<span class="badge-false">FALSE</span>'}
        </td>
      </tr>`;
  }
  rows += `
    <tr class="total-row">
      <td colspan="1">TOTAL</td>
      <td class="pct">${data.total.toFixed(2)}%</td>
      <td></td><td></td>
    </tr>`;

  document.getElementById('resultPanel').innerHTML = `
    <div class="summary-bar">
      <div>合計 <span>${data.total.toFixed(1)}%</span></div>
      <div>TRUE (≥8%) <span>${data.above_threshold} カテゴリ</span></div>
      <div>FALSE <span>${38 - data.above_threshold} カテゴリ</span></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right">Bachelor's %</th>
          <th></th>
          <th>判定</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function setStatus(msg, isErr) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isErr ? 'err' : '';
}
</script>
</body>
</html>
"""


# ── Flask ルート ──────────────────────────────────────────

@app.route("/")
def index():
    return render_template_string(HTML, threshold=THRESHOLD)


@app.route("/parse", methods=["POST"])
def parse():
    body = request.get_json(silent=True) or {}
    raw  = body.get("raw", "")
    if not raw:
        return jsonify({"error": "テキストが空です"})

    values = parse_pasted(raw)
    total  = sum(values.values())
    above  = sum(1 for v in values.values() if v >= THRESHOLD)

    return jsonify({
        "values":          values,
        "total":           round(total, 2),
        "above_threshold": above,
    })


@app.route("/save", methods=["POST"])
def save():
    body     = request.get_json(silent=True) or {}
    uni_name = body.get("uni_name", "").strip()
    values   = body.get("values", {})

    if not uni_name:
        return jsonify({"error": "大学名が空です"})

    csv_path = find_latest_csv()
    if not csv_path:
        return jsonify({"error": f"CSV ファイルが見つかりません（{PARENT}）"})

    fieldnames, rows = read_csv(csv_path)
    matched = [r for r in rows if r.get("大学名", "").strip() == uni_name]
    if not matched:
        return jsonify({"error": f"「{uni_name}」が CSV に見つかりません"})

    updated = 0
    for row in rows:
        if row.get("大学名", "").strip() != uni_name:
            continue
        for cat, pct in values.items():
            if cat in row:
                row[cat] = "TRUE" if pct >= THRESHOLD else "FALSE"
        updated += 1

    write_csv(csv_path, fieldnames, rows)
    return jsonify({
        "message": f"{csv_path.name} の「{uni_name}」を更新しました（{updated} 行）"
    })


if __name__ == "__main__":
    csv_path = find_latest_csv()
    print("=" * 52)
    print("  CDS Major Evaluator")
    print("  http://localhost:5050")
    print(f"  CSV: {csv_path.name if csv_path else '見つかりません'}")
    print("=" * 52)
    app.run(port=5050, debug=False)
