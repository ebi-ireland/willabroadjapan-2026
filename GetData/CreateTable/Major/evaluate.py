"""
evaluate.py  ―  CDS 専攻割合パーサー
======================================
Common Data Set の専攻割合テーブルを貼り付けると
  ・各カテゴリの割合を自動解析
  ・8% 以上のカテゴリのチェックボックスを TRUE にセット
  ・../dataset_YYYY_MM_DD.csv（最新）の該当大学行を上書き保存

使い方:
  python evaluate.py
  → ブラウザで http://localhost:5050 を開く

依存:
  pip install flask
"""

import csv
import glob
import json
import os
import re
from pathlib import Path
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

# ── パス設定 ──────────────────────────────────────────────
HERE        = Path(__file__).parent          # .../Major/
PARENT      = HERE.parent                    # .../CreateTable/
THRESHOLD   = 8.0                            # チェックボックスを TRUE にする閾値(%)

# ── 38カテゴリ（create_table.py と完全一致・順番通り）────
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

# ── CSV ユーティリティ ────────────────────────────────────

def find_latest_csv() -> Path | None:
    """PARENT フォルダ内の最新 dataset_*.csv を返す。"""
    files = sorted(PARENT.glob("dataset_*.csv"), reverse=True)
    return files[0] if files else None


def read_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    return fieldnames, rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

# ── 解析ロジック ──────────────────────────────────────────

def parse_pasted(raw: str) -> dict:
    """
    貼り付けテキストから38カテゴリの Bachelor 割合を抽出する。

    CDS の横コピー形式:
      [カテゴリ名]  [Diploma値?]  [Associate値?]  [Bachelor値]
    ・カテゴリ名の先頭一致で行を特定
    ・同行内の数値が複数あれば最後の値 = Bachelor とみなす
    ・合計 ≈ 1.0 なら ×100 してパーセントに変換
    """
    lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
    lines = [l for l in lines if not re.match(r"(other|total)", l, re.I)]

    values: dict[str, float] = {}

    for line in lines:
        nums_f = [float(n) for n in re.findall(r"[-+]?\d+(?:\.\d+)?", line)]
        for cat in CATEGORIES:
            # カテゴリ名の先頭20文字で照合（タブ混在に対応）
            if line.lower().startswith(cat.lower()[:20]):
                # 複数値 → 最後が Bachelor（Diploma/Associate は先頭）
                values[cat] = nums_f[-1] if nums_f else 0.0
                break

    # 未登場カテゴリは 0
    for cat in CATEGORIES:
        if cat not in values:
            values[cat] = 0.0

    # 合計 ≈ 1.0 → ×100
    total = sum(values.values())
    if 0.9 <= total <= 1.1:
        values = {k: round(v * 100, 2) for k, v in values.items()}

    return {cat: round(values[cat], 2) for cat in CATEGORIES}


# ── Flask ルート ──────────────────────────────────────────

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
    --high:    #5bffc8;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
    padding: 2rem;
  }

  header {
    margin-bottom: 2.5rem;
  }
  header h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.8rem;
    letter-spacing: -0.02em;
    color: var(--accent);
  }
  header p { color: var(--muted); font-size: 0.78rem; margin-top: 0.3rem; }

  .layout { display: grid; grid-template-columns: 380px 1fr; gap: 1.5rem; }

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
  input[type="text"]:focus, textarea:focus {
    border-color: var(--accent);
  }
  textarea {
    resize: vertical;
    min-height: 260px;
    line-height: 1.5;
  }

  .hint {
    font-size: 0.7rem;
    color: var(--muted);
    margin-top: 0.35rem;
    line-height: 1.5;
  }

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
  button#parseBtn:hover { opacity: 0.88; }
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

  /* Results table */
  .result-panel { overflow-y: auto; max-height: 85vh; }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
  }
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

  td { padding: 0.5rem 0.8rem; }
  td.pct {
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: var(--muted);
  }
  td.pct.hi { color: var(--high); font-weight: 500; }
  td.bar { width: 120px; }
  td.check { text-align: center; }

  .bar-wrap { background: #1a1d24; border-radius: 3px; height: 6px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width 0.4s ease; }
  .bar-fill.hi { background: var(--high); }

  .badge-true {
    display: inline-block;
    background: rgba(91,255,200,0.15);
    color: var(--accent);
    border: 1px solid rgba(91,255,200,0.35);
    border-radius: 4px;
    font-size: 0.68rem;
    padding: 0.15rem 0.45rem;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
  }
  .badge-false {
    color: #3a3d46;
    font-size: 0.68rem;
  }

  .total-row td {
    border-top: 1px solid var(--border);
    font-weight: 500;
    color: var(--accent);
    font-family: 'Syne', sans-serif;
  }

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
  <p>Common Data Set の専攻割合を貼り付けて解析 → CSV へ反映</p>
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
      <textarea id="rawData" placeholder="CDS の専攻割合テーブルをここに貼り付け&#10;&#10;Category列・数値列すべてを横ごとコピーしてください。&#10;&#10;例:&#10;Agriculture&#10;Natural resources and conservation&#10;Architecture  2.5%&#10;..."></textarea>
      <p class="hint">
        ・横方向コピーで OK（Diploma / Associate / Bachelor の順）<br>
        ・合計が 1.00 の場合は自動で ×100 します<br>
        ・Other・TOTAL 行は自動除外されます
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
  const uniName = document.getElementById('uniName').value.trim();
  const raw     = document.getElementById('rawData').value.trim();
  const status  = document.getElementById('status');

  if (!raw) { setStatus('テキストを貼り付けてください', true); return; }

  setStatus('解析中...', false);

  const res  = await fetch('/parse', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ raw, uni_name: uniName })
  });
  const data = await res.json();

  if (data.error) { setStatus(data.error, true); return; }

  lastResult = data;
  renderTable(data);
  document.getElementById('saveBtn').style.display = uniName ? 'block' : 'none';
  setStatus(`解析完了 — 合計 ${data.total.toFixed(1)}%  /  8%超: ${data.above_threshold}カテゴリ`, false);
}

async function saveToCSV() {
  if (!lastResult) return;
  const uniName = document.getElementById('uniName').value.trim();
  if (!uniName) { setStatus('大学名を入力してください', true); return; }

  setStatus('保存中...', false);
  const res  = await fetch('/save', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ uni_name: uniName, values: lastResult.values })
  });
  const data = await res.json();
  if (data.error) { setStatus('⚠ ' + data.error, true); }
  else            { setStatus('✅ ' + data.message, false); }
}

function renderTable(data) {
  const maxPct = Math.max(...Object.values(data.values), 1);
  let rows = '';
  for (const [cat, pct] of Object.entries(data.values)) {
    const hi     = pct >= {{ threshold }};
    const pctStr = pct.toFixed(1) + '%';
    const barW   = Math.round((pct / maxPct) * 100);
    rows += `
      <tr>
        <td>${cat}</td>
        <td class="pct ${hi ? 'hi' : ''}">${pctStr}</td>
        <td class="bar">
          <div class="bar-wrap">
            <div class="bar-fill ${hi ? 'hi' : ''}" style="width:${barW}%"></div>
          </div>
        </td>
        <td class="check">
          ${hi ? '<span class="badge-true">TRUE</span>' : '<span class="badge-false">—</span>'}
        </td>
      </tr>`;
  }
  rows += `
    <tr class="total-row">
      <td>TOTAL</td>
      <td class="pct">${data.total.toFixed(1)}%</td>
      <td></td><td></td>
    </tr>`;

  document.getElementById('resultPanel').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right">Bachelor's %</th>
          <th></th>
          <th>8%超チェック</th>
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


@app.route("/")
def index():
    return render_template_string(HTML, threshold=THRESHOLD)


@app.route("/parse", methods=["POST"])
def parse():
    body = request.get_json()
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
    body     = request.get_json()
    uni_name = body.get("uni_name", "").strip()
    values   = body.get("values", {})

    if not uni_name:
        return jsonify({"error": "大学名が空です"})

    csv_path = find_latest_csv()
    if not csv_path:
        return jsonify({"error": f"CSVファイルが見つかりません（{PARENT}）"})

    fieldnames, rows = read_csv(csv_path)

    # 大学名で行を検索
    matched = [r for r in rows if r.get("大学名", "").strip() == uni_name]
    if not matched:
        return jsonify({"error": f"「{uni_name}」が CSV に見つかりません"})

    updated = 0
    for row in rows:
        if row.get("大学名", "").strip() != uni_name:
            continue
        for cat, pct in values.items():
            if cat not in row:
                continue
            # チェックボックス列: 8%以上→TRUE / 未満→FALSE
            # 数値そのものは保存しない（列がチェックボックス型のため）
            row[cat] = "TRUE" if pct >= THRESHOLD else "FALSE"
        updated += 1

    write_csv(csv_path, fieldnames, rows)
    return jsonify({
        "message": f"{csv_path.name} の「{uni_name}」を更新しました（{updated}行）"
    })


if __name__ == "__main__":
    print("=" * 50)
    print("  CDS Major Evaluator")
    print(f"  http://localhost:5050")
    print(f"  CSV 対象: {find_latest_csv() or '見つかりません'}")
    print("=" * 50)
    app.run(port=5050, debug=False)