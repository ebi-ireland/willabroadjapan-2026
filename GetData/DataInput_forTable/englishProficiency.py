"""
englishProficiency.py  ―  英語力要件入力パネル
================================================
大学が求める英語力（TOEFL / IELTS / Duolingo）を入力して JSON に保存する。

左パネル : 検索 + 既存大学一覧（1万件以上対応）
右パネル : 入力フォーム

使い方:
  python englishProficiency.py
  → ブラウザで http://localhost:5052 を開く

出力先:
  ../../CreateTable/english_proficiency.json

依存:
  pip install flask
"""

import json
import os
import threading
from pathlib import Path
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

HERE        = Path(__file__).parent                       # .../DataInput_forTable/
OUTPUT_JSON = HERE.parent / "CreateTable" / "english_proficiency.json"

# 他の2パネルのJSON（新規追加時に空エントリを同期）
OTHER_JSONS = [
    HERE.parent / "CreateTable" / "input_data.json",
    HERE.parent / "CreateTable" / "other_conditions.json",
]


# ─────────────────────────────────────────────
#  JSON ユーティリティ
# ─────────────────────────────────────────────

def load_data() -> list[dict]:
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_data(records: list[dict]):
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


# ─────────────────────────────────────────────
#  Flask ルート
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/api/list")
def api_list():
    return jsonify([r.get("大学名", "") for r in load_data()])


@app.route("/api/load/<path:name>")
def api_load(name):
    for r in load_data():
        if r.get("大学名") == name:
            return jsonify(r)
    return jsonify({}), 404


def sync_name_to_others(name: str):
    """新規大学名を他の2つのJSONにも空エントリとして追加する。"""
    for path in OTHER_JSONS:
        try:
            records = []
            if path.exists():
                with open(path, encoding="utf-8") as f:
                    records = json.load(f)
            if any(r.get("大学名") == name for r in records):
                continue
            records.append({"大学名": name})
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"  [sync] {path.name} への同期失敗: {e}")


@app.route("/api/save", methods=["POST"])
def api_save():
    body = request.get_json(silent=True) or {}
    name = body.get("大学名", "").strip()
    if not name:
        return jsonify({"error": "大学名が空です"}), 400

    records = load_data()
    idx = next((i for i, r in enumerate(records) if r.get("大学名") == name), None)
    is_new = idx is None

    if idx is not None:
        records[idx] = body
        msg = f"「{name}」を更新しました"
    else:
        records.append(body)
        msg = f"「{name}」を追加しました（合計 {len(records)} 件）"

    save_data(records)

    if is_new:
        sync_name_to_others(name)
        msg += " ／ 他2パネルにも空エントリを追加しました"

    return jsonify({"message": msg, "count": len(records)})


@app.route("/api/delete", methods=["POST"])
def api_delete():
    body = request.get_json(silent=True) or {}
    name = body.get("大学名", "").strip()
    records = load_data()
    new_records = [r for r in records if r.get("大学名") != name]
    if len(new_records) == len(records):
        return jsonify({"error": f"「{name}」が見つかりません"}), 404
    save_data(new_records)
    return jsonify({"message": f"「{name}」を削除しました", "count": len(new_records)})


@app.route("/api/shutdown", methods=["POST"])
def api_shutdown():
    threading.Timer(0.5, lambda: os._exit(0)).start()
    return jsonify({"message": "サーバーを終了します"})


# ─────────────────────────────────────────────
#  HTML テンプレート
# ─────────────────────────────────────────────

HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>English Proficiency Panel</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg:       #0d0f14;
    --surface:  #161920;
    --surface2: #1e2230;
    --border:   #252830;
    --border2:  #353a4a;
    --accent:   #5bffc8;
    --accent2:  #ff6b6b;
    --accent3:  #ffc85b;
    --toefl:    #60a5fa;
    --ielts:    #a78bfa;
    --duolingo: #34d399;
    --text:     #e8eaf0;
    --muted:    #6b7280;
    --muted2:   #4a4f5e;
    --topbar-h: 48px;
    --sidebar-w: 210px;
    --actionbar-h: 56px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
  }

  /* ══════════════════════════════
     固定ヘッダー
  ══════════════════════════════ */
  .top-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: var(--topbar-h);
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    z-index: 200;
  }
  .top-bar h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.9rem;
    color: var(--accent);
    white-space: nowrap;
  }
  .top-bar .subtitle { font-size: 0.65rem; color: var(--muted); white-space: nowrap; }
  .top-bar .count-badge {
    margin-left: auto;
    font-size: 0.65rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .top-bar .count-badge span { color: var(--accent); font-weight: 600; }

  /* ══════════════════════════════
     固定 左パネル（検索 + 一覧）
  ══════════════════════════════ */
  .left-panel {
    position: fixed;
    top: var(--topbar-h);
    left: 0;
    bottom: 0;
    width: var(--sidebar-w);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 100;
  }

  .search-box {
    padding: 0.6rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .search-wrap {
    position: relative;
  }
  .search-wrap svg {
    position: absolute;
    left: 0.6rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    pointer-events: none;
  }
  .search-wrap input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    padding: 0.5rem 0.6rem 0.5rem 2rem;
    outline: none;
  }
  .search-wrap input:focus { border-color: var(--accent); }
  .search-wrap input::placeholder { color: var(--muted2); }

  .search-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.65rem;
    color: var(--muted);
    margin-top: 0.35rem;
  }
  .match-count { color: var(--accent3); }

  .btn-new {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.45rem;
    background: transparent;
    border: 1px solid var(--border2);
    border-radius: 5px;
    color: var(--accent);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.72rem;
    cursor: pointer;
  }
  .btn-new:hover { background: rgba(91,255,200,0.07); }

  .uni-list {
    flex: 1;
    overflow-y: auto;
  }
  .uni-list::-webkit-scrollbar { width: 4px; }
  .uni-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  .uni-item {
    display: flex;
    align-items: flex-start;
    padding: 0.45rem 0.8rem;
    font-size: 0.72rem;
    color: var(--text);
    cursor: pointer;
    border-left: 2px solid transparent;
    line-height: 1.4;
  }
  .uni-item:hover { background: var(--surface2); border-left-color: var(--border2); }
  .uni-item.active { background: rgba(91,255,200,0.08); border-left-color: var(--accent); color: var(--accent); }
  .uni-idx { font-size: 0.6rem; color: var(--muted2); margin-right: 0.5rem; min-width: 28px; text-align: right; flex-shrink: 0; padding-top: 1px; }
  .no-result { padding: 1.5rem 0.8rem; font-size: 0.72rem; color: var(--muted2); text-align: center; }

  /* ══════════════════════════════
     メインコンテンツ（通常フロー）
  ══════════════════════════════ */
  .main-content {
    margin-left: var(--sidebar-w);
    margin-top: var(--topbar-h);
    margin-bottom: var(--actionbar-h);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  /* ── 大学名 ── */
  .uni-name-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem;
  }
  .uni-name-card label {
    display: block;
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
  }
  .uni-name-card input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.9rem;
    padding: 0.6rem 0.8rem;
    outline: none;
  }
  .uni-name-card input:focus { border-color: var(--accent); }

  /* ── スコアなしチェック ── */
  .no-score-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.9rem 1.2rem;
  }
  .no-score-card label {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    cursor: pointer;
  }
  .no-score-card input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent3);
    flex-shrink: 0;
    margin-top: 2px;
    cursor: pointer;
  }
  .no-score-text { font-size: 0.82rem; color: var(--text); line-height: 1.5; }
  .no-score-text small { display: block; font-size: 0.68rem; color: var(--muted); margin-top: 0.15rem; }

  /* ── テストカード ── */
  .test-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .test-card-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .test-name {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
  }
  .test-name.toefl    { color: var(--toefl); }
  .test-name.ielts    { color: var(--ielts); }
  .test-name.duolingo { color: var(--duolingo); }
  .test-range { font-size: 0.62rem; color: var(--muted); }

  /* ── スコア 2段レイアウト ── */
  .score-body { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.7rem; }

  /* 1段目：総合スコア */
  .score-total-row { display: flex; align-items: flex-end; gap: 0.8rem; }
  .total-label {
    font-size: 0.68rem;
    color: var(--accent3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
    width: 2.5rem;
    padding-bottom: 0.3rem;
  }
  .total-input {
    flex: 1;
    max-width: 160px;
  }

  /* 2段目：4セクション */
  .score-sections-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }

  .score-col .col-label {
    display: block;
    font-size: 0.6rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  /* 共通 input スタイル */
  .score-col input[type="number"],
  .total-input input[type="number"] {
    display: block;
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.88rem;
    padding: 0.45rem 0.55rem;
    outline: none;
    text-align: right;
    -moz-appearance: textfield;
  }
  .score-col input[type="number"]::-webkit-outer-spin-button,
  .score-col input[type="number"]::-webkit-inner-spin-button,
  .total-input input[type="number"]::-webkit-outer-spin-button,
  .total-input input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
  .score-col input[type="number"]:focus,
  .total-input input[type="number"]:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(91,255,200,0.15);
  }
  .score-col input[type="number"]:hover:not(:disabled),
  .total-input input[type="number"]:hover:not(:disabled) { border-color: var(--muted); }
  .score-col input[type="number"]:disabled,
  .total-input input[type="number"]:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: var(--bg);
  }
  .score-col input[type="number"]::placeholder,
  .total-input input[type="number"]::placeholder { color: var(--muted2); font-size: 0.75rem; }

  /* ══════════════════════════════
     固定 アクションバー
  ══════════════════════════════ */
  .action-bar {
    position: fixed;
    bottom: 0;
    left: var(--sidebar-w);
    right: 0;
    height: var(--actionbar-h);
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0 1.5rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 200;
  }
  #statusMsg { flex: 1; font-size: 0.75rem; color: var(--accent); }
  #statusMsg.err { color: var(--accent2); }

  .btn {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.82rem;
    padding: 0.55rem 1.4rem;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    white-space: nowrap;
  }
  .btn-primary { background: var(--accent); color: #0d0f14; }
  .btn-primary:hover { opacity: 0.88; }
  .btn-delete  { background: transparent; color: var(--accent2); border: 1px solid var(--accent2); }
  .btn-delete:hover { background: rgba(255,107,107,0.1); }
  .btn-exit    { background: transparent; color: var(--muted); border: 1px solid var(--border2); }
  .btn-exit:hover { color: var(--text); border-color: var(--muted); }
</style>
</head>
<body>

<!-- ── 固定ヘッダー ── -->
<div class="top-bar">
  <h1>English Proficiency Panel</h1>
  <span class="subtitle">大学の英語力要件を登録</span>
  <div class="count-badge">登録済み <span id="totalCount">0</span> 件</div>
</div>

<!-- ── 固定 左パネル ── -->
<div class="left-panel">
  <div class="search-box">
    <div class="search-wrap">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="searchInput" placeholder="大学名で検索…" oninput="filterList()">
    </div>
    <div class="search-meta">
      <span class="match-count" id="matchCount"></span>
      <span id="totalLabel"></span>
    </div>
    <button class="btn-new" onclick="newEntry()">＋ 新規入力</button>
  </div>
  <div class="uni-list" id="uniList"></div>
</div>

<!-- ── メインコンテンツ（通常フロー = 入力可能）── -->
<div class="main-content">

  <!-- 大学名 -->
  <div class="uni-name-card">
    <label>大学名 <span style="color:var(--accent2)">*</span></label>
    <input type="text" id="f_univ" placeholder="例: Harvard University" oninput="onNameChange()">
  </div>

  <!-- スコア提出あるがスコア条件なし -->
  <div class="no-score-card">
    <label>
      <input type="checkbox" id="f_no_score" onchange="toggleScores()">
      <div class="no-score-text">
        スコア提出はあるがスコア条件はなし
        <small>チェックすると数値フィールドがすべて無効になります</small>
      </div>
    </label>
  </div>

  <!-- TOEFL -->
  <div class="test-card">
    <div class="test-card-header">
      <span class="test-name toefl">TOEFL iBT</span>
      <span class="test-range">総合 0–120 ／ セクション 0–30</span>
    </div>
    <div class="score-body">
      <div class="score-total-row">
        <span class="total-label">総合</span>
        <div class="total-input">
          <input type="number" id="f_TOEFL_total" min="0" max="120" placeholder="100">
        </div>
      </div>
      <div class="score-sections-row">
        <div class="score-col"><span class="col-label">Reading</span>  <input type="number" id="f_TOEFL_reading"   min="0" max="30" placeholder="22"></div>
        <div class="score-col"><span class="col-label">Listening</span><input type="number" id="f_TOEFL_listening" min="0" max="30" placeholder="22"></div>
        <div class="score-col"><span class="col-label">Writing</span>  <input type="number" id="f_TOEFL_writing"   min="0" max="30" placeholder="22"></div>
        <div class="score-col"><span class="col-label">Speaking</span> <input type="number" id="f_TOEFL_speaking"  min="0" max="30" placeholder="22"></div>
      </div>
    </div>
  </div>

  <!-- IELTS -->
  <div class="test-card">
    <div class="test-card-header">
      <span class="test-name ielts">IELTS</span>
      <span class="test-range">総合 0–9 ／ セクション 0–9（0.5 刻み）</span>
    </div>
    <div class="score-body">
      <div class="score-total-row">
        <span class="total-label">総合</span>
        <div class="total-input">
          <input type="number" id="f_IELTS_total" min="0" max="9" step="0.5" placeholder="7.0">
        </div>
      </div>
      <div class="score-sections-row">
        <div class="score-col"><span class="col-label">Reading</span>  <input type="number" id="f_IELTS_reading"   min="0" max="9" step="0.5" placeholder="6.5"></div>
        <div class="score-col"><span class="col-label">Listening</span><input type="number" id="f_IELTS_listening" min="0" max="9" step="0.5" placeholder="6.5"></div>
        <div class="score-col"><span class="col-label">Writing</span>  <input type="number" id="f_IELTS_writing"   min="0" max="9" step="0.5" placeholder="6.5"></div>
        <div class="score-col"><span class="col-label">Speaking</span> <input type="number" id="f_IELTS_speaking"  min="0" max="9" step="0.5" placeholder="6.5"></div>
      </div>
    </div>
  </div>

  <!-- Duolingo -->
  <div class="test-card">
    <div class="test-card-header">
      <span class="test-name duolingo">Duolingo English Test</span>
      <span class="test-range">各スコア 10–160</span>
    </div>
    <div class="score-body">
      <div class="score-total-row">
        <span class="total-label">総合</span>
        <div class="total-input">
          <input type="number" id="f_DET_total" min="10" max="160" placeholder="120">
        </div>
      </div>
      <div class="score-sections-row">
        <div class="score-col"><span class="col-label">Literacy</span>      <input type="number" id="f_DET_literacy"      min="10" max="160" placeholder="110"></div>
        <div class="score-col"><span class="col-label">Comprehension</span> <input type="number" id="f_DET_comprehension"  min="10" max="160" placeholder="110"></div>
        <div class="score-col"><span class="col-label">Conversation</span>  <input type="number" id="f_DET_conversation"   min="10" max="160" placeholder="100"></div>
        <div class="score-col"><span class="col-label">Production</span>    <input type="number" id="f_DET_production"     min="10" max="160" placeholder="100"></div>
      </div>
    </div>
  </div>

</div><!-- /main-content -->

<!-- ── 固定 アクションバー ── -->
<div class="action-bar">
  <div id="statusMsg"></div>
  <button class="btn btn-delete" id="deleteBtn" onclick="deleteEntry()" style="display:none">削除</button>
  <button class="btn btn-primary" onclick="saveEntry()">追加 / 更新</button>
  <button class="btn btn-exit"    onclick="shutdown()">終了</button>
</div>

<script>
// ─── 定数マップ（ID ↔ JSONキー）────────────────────────────────
const SCORE_MAP = {
  'f_TOEFL_total':         'TOEFL 総合',
  'f_TOEFL_reading':       'TOEFL Reading',
  'f_TOEFL_listening':     'TOEFL Listening',
  'f_TOEFL_writing':       'TOEFL Writing',
  'f_TOEFL_speaking':      'TOEFL Speaking',
  'f_IELTS_total':         'IELTS 総合',
  'f_IELTS_reading':       'IELTS Reading',
  'f_IELTS_listening':     'IELTS Listening',
  'f_IELTS_writing':       'IELTS Writing',
  'f_IELTS_speaking':      'IELTS Speaking',
  'f_DET_total':           'Duolingo 総合',
  'f_DET_literacy':        'Duolingo Literacy',
  'f_DET_comprehension':   'Duolingo Comprehension',
  'f_DET_conversation':    'Duolingo Conversation',
  'f_DET_production':      'Duolingo Production',
}

// ─── 状態 ────────────────────────────────────────────────────
let allNames   = []
let activeName = null

// ─── 初期化 ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { refreshList() })

async function refreshList() {
  const res  = await fetch('/api/list')
  allNames   = await res.json()
  document.getElementById('totalCount').textContent = allNames.length
  document.getElementById('totalLabel').textContent = `全 ${allNames.length} 件`
  filterList()
}

// ─── 検索 ────────────────────────────────────────────────────
function filterList() {
  const q        = document.getElementById('searchInput').value.trim().toLowerCase()
  const filtered = q ? allNames.filter(n => n.toLowerCase().includes(q)) : [...allNames]
  document.getElementById('matchCount').textContent = q ? `${filtered.length} 件一致` : ''

  const container = document.getElementById('uniList')
  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-result">一致する大学が見つかりません</div>'
    return
  }
  const display = filtered.slice(0, 200)
  const more    = filtered.length - 200
  container.innerHTML =
    display.map(name => `
      <div class="uni-item ${name === activeName ? 'active' : ''}" onclick="loadEntry('${esc(name)}')">
        <span class="uni-idx">${allNames.indexOf(name) + 1}</span>
        <span>${esc(name)}</span>
      </div>`).join('') +
    (more > 0 ? `<div class="no-result">…他 ${more} 件（検索を絞り込んでください）</div>` : '')
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}

// ─── 読み込み ─────────────────────────────────────────────────
async function loadEntry(name) {
  activeName = name
  filterList()
  const res  = await fetch('/api/load/' + encodeURIComponent(name))
  if (!res.ok) { setStatus('読み込みに失敗しました', true); return }
  fillForm(await res.json())
  document.getElementById('deleteBtn').style.display = ''
  setStatus(`「${name}」を読み込みました`, false)
}

function newEntry() {
  activeName = null
  clearForm()
  filterList()
  document.getElementById('deleteBtn').style.display = 'none'
  document.getElementById('f_univ').focus()
  setStatus('新規入力モード', false)
}

// ─── フォーム ─────────────────────────────────────────────────
function fillForm(data) {
  document.getElementById('f_univ').value = data['大学名'] || ''
  Object.entries(SCORE_MAP).forEach(([id, key]) => {
    const el = document.getElementById(id)
    if (el) el.value = (data[key] != null) ? data[key] : ''
  })
  document.getElementById('f_no_score').checked = !!data['スコア提出はあるがスコア条件はなし']
  toggleScores()
}

function collectForm() {
  const data = { '大学名': (document.getElementById('f_univ').value || '').trim() }
  Object.entries(SCORE_MAP).forEach(([id, key]) => {
    const el = document.getElementById(id)
    if (!el) return
    const v = el.value.trim()
    data[key] = v === '' ? null : parseFloat(v)
  })
  data['スコア提出はあるがスコア条件はなし'] = document.getElementById('f_no_score').checked
  return data
}

function clearForm() {
  document.getElementById('f_univ').value = ''
  Object.keys(SCORE_MAP).forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  document.getElementById('f_no_score').checked = false
  toggleScores()
}

function toggleScores() {
  const disabled = document.getElementById('f_no_score').checked
  document.querySelectorAll('.score-body input[type="number"]').forEach(el => {
    el.disabled = disabled
  })
}

function onNameChange() {
  if (activeName && document.getElementById('f_univ').value.trim() !== activeName) {
    document.getElementById('deleteBtn').style.display = 'none'
  }
}

// ─── API ─────────────────────────────────────────────────────
async function saveEntry() {
  const data = collectForm()
  if (!data['大学名']) { setStatus('大学名を入力してください', true); return }
  setStatus('保存中...', false)
  const res  = await fetch('/api/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  })
  const j = await res.json()
  if (j.error) { setStatus('⚠ ' + j.error, true); return }
  activeName = data['大学名']
  document.getElementById('deleteBtn').style.display = ''
  setStatus('✅ ' + j.message, false)
  await refreshList()
}

async function deleteEntry() {
  const name = (document.getElementById('f_univ').value || '').trim()
  if (!name || !confirm(`「${name}」を削除しますか？`)) return
  const res  = await fetch('/api/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ '大学名': name })
  })
  const j = await res.json()
  if (j.error) { setStatus('⚠ ' + j.error, true); return }
  activeName = null
  clearForm()
  document.getElementById('deleteBtn').style.display = 'none'
  setStatus('🗑 ' + j.message, false)
  await refreshList()
}

async function shutdown() {
  if (!confirm('サーバーを終了しますか？')) return
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#6b7280;">サーバーを終了しました。このタブを閉じてください。</div>'
}

function setStatus(msg, isErr) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className   = isErr ? 'err' : ''
}
</script>
</body>
</html>
"""


if __name__ == "__main__":
    count = len(load_data())
    print("=" * 56)
    print("  English Proficiency Panel")
    print("  http://localhost:5052")
    print(f"  出力先: {OUTPUT_JSON}")
    print(f"  登録済み: {count} 件")
    print("=" * 56)
    app.run(port=5052, debug=False)
