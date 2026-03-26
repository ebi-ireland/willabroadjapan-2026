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

HERE        = Path(__file__).parent
OUTPUT_JSON = HERE.parent.parent / "CreateTable" / "english_proficiency.json"


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


@app.route("/api/save", methods=["POST"])
def api_save():
    body = request.get_json(silent=True) or {}
    name = body.get("大学名", "").strip()
    if not name:
        return jsonify({"error": "大学名が空です"}), 400

    records = load_data()
    idx = next((i for i, r in enumerate(records) if r.get("大学名") == name), None)

    if idx is not None:
        records[idx] = body
        msg = f"「{name}」を更新しました"
    else:
        records.append(body)
        msg = f"「{name}」を追加しました（合計 {len(records)} 件）"

    save_data(records)
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
    --surface2: #1c1f28;
    --border:   #252830;
    --border2:  #2e3240;
    --accent:   #5bffc8;
    --accent2:  #ff6b6b;
    --accent3:  #ffc85b;
    --toefl:    #60a5fa;
    --ielts:    #a78bfa;
    --duolingo: #34d399;
    --text:     #e8eaf0;
    --muted:    #6b7280;
    --muted2:   #4a4f5e;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── ヘッダー ── */
  .top-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .top-bar h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1rem;
    color: var(--accent);
    white-space: nowrap;
  }
  .top-bar .subtitle {
    font-size: 0.68rem;
    color: var(--muted);
  }
  .top-bar .count-badge {
    margin-left: auto;
    font-size: 0.68rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .top-bar .count-badge span {
    color: var(--accent);
    font-weight: 600;
  }

  /* ── メインレイアウト ── */
  .layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    flex: 1;
    overflow: hidden;
  }

  /* ── 左パネル（検索 + 一覧） ── */
  .left-panel {
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .search-box {
    padding: 0.8rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .search-input-wrap {
    position: relative;
  }
  .search-input-wrap svg {
    position: absolute;
    left: 0.6rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
    pointer-events: none;
  }
  .search-input-wrap input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    padding: 0.5rem 0.6rem 0.5rem 2rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input-wrap input:focus { border-color: var(--accent); }
  .search-input-wrap input::placeholder { color: var(--muted2); }

  .search-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.4rem;
    font-size: 0.65rem;
    color: var(--muted);
  }
  .search-meta .match-count { color: var(--accent3); }

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
    transition: background 0.15s;
  }
  .btn-new:hover { background: rgba(91,255,200,0.07); }

  .uni-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.3rem 0;
  }
  .uni-list::-webkit-scrollbar { width: 4px; }
  .uni-list::-webkit-scrollbar-track { background: transparent; }
  .uni-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

  .uni-item {
    display: flex;
    align-items: center;
    padding: 0.45rem 0.8rem;
    font-size: 0.72rem;
    color: var(--text);
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.1s, border-color 0.1s;
    word-break: break-word;
    line-height: 1.4;
  }
  .uni-item:hover { background: var(--surface2); border-left-color: var(--border2); }
  .uni-item.active { background: rgba(91,255,200,0.08); border-left-color: var(--accent); color: var(--accent); }
  .uni-item .uni-idx {
    font-size: 0.6rem;
    color: var(--muted2);
    margin-right: 0.5rem;
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  .no-result {
    padding: 1.5rem 0.8rem;
    font-size: 0.72rem;
    color: var(--muted2);
    text-align: center;
  }

  /* ── 右パネル（フォーム） ── */
  .right-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .form-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .form-scroll::-webkit-scrollbar { width: 5px; }
  .form-scroll::-webkit-scrollbar-track { background: transparent; }
  .form-scroll::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  /* ── 大学名 ── */
  .uni-name-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem;
  }
  .uni-name-section label {
    display: block;
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.4rem;
  }
  .uni-name-section input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.9rem;
    padding: 0.55rem 0.8rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .uni-name-section input:focus { border-color: var(--accent); }

  /* ── テストカード ── */
  .test-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .test-card-header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.75rem 1.2rem;
    border-bottom: 1px solid var(--border);
  }
  .test-label {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.95rem;
    letter-spacing: 0.03em;
  }
  .test-label.toefl   { color: var(--toefl); }
  .test-label.ielts   { color: var(--ielts); }
  .test-label.duolingo { color: var(--duolingo); }
  .test-range {
    font-size: 0.65rem;
    color: var(--muted);
    margin-left: auto;
  }

  .test-card-body {
    padding: 1rem 1.2rem;
  }
  .score-grid {
    display: grid;
    grid-template-columns: 1.3fr repeat(4, 1fr);
    gap: 0.7rem 1rem;
    align-items: end;
  }

  .score-field label {
    display: block;
    font-size: 0.65rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 0.3rem;
    white-space: nowrap;
  }
  .score-field.total label { color: var(--accent3); }

  .score-field input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 5px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.85rem;
    padding: 0.45rem 0.6rem;
    outline: none;
    transition: border-color 0.15s, opacity 0.2s;
    text-align: right;
  }
  .score-field input:focus { border-color: var(--accent); }
  .score-field input:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* ── スコアなしチェック ── */
  .no-score-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem 1.2rem;
  }
  .no-score-section label {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    cursor: pointer;
    line-height: 1.5;
  }
  .no-score-section input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent3);
    flex-shrink: 0;
    margin-top: 2px;
    cursor: pointer;
  }
  .no-score-label-text {
    font-size: 0.82rem;
    color: var(--text);
  }
  .no-score-label-text small {
    display: block;
    font-size: 0.68rem;
    color: var(--muted);
    margin-top: 0.2rem;
  }

  /* ── アクションバー ── */
  .action-bar {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 1.5rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  #statusMsg {
    flex: 1;
    font-size: 0.75rem;
    color: var(--accent);
    min-height: 1rem;
  }
  #statusMsg.err { color: var(--accent2); }

  .btn {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.82rem;
    padding: 0.55rem 1.4rem;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: var(--accent);  color: #0d0f14; }
  .btn-primary:hover { opacity: 0.88; }
  .btn-delete  { background: transparent; color: var(--accent2); border: 1px solid var(--accent2); }
  .btn-delete:hover { background: rgba(255,107,107,0.1); }
  .btn-danger  { background: transparent; color: var(--muted); border: 1px solid var(--border2); }
  .btn-danger:hover { color: var(--text); border-color: var(--muted); }
</style>
</head>
<body>

<!-- ── ヘッダー ── -->
<div class="top-bar">
  <h1>English Proficiency Panel</h1>
  <span class="subtitle">大学の英語力要件を登録</span>
  <div class="count-badge">登録済み <span id="totalCount">0</span> 件</div>
</div>

<!-- ── メイン ── -->
<div class="layout">

  <!-- 左パネル：検索 + 一覧 -->
  <div class="left-panel">
    <div class="search-box">
      <div class="search-input-wrap">
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

  <!-- 右パネル：入力フォーム -->
  <div class="right-panel">
    <div class="form-scroll" id="formScroll">

      <!-- 大学名 -->
      <div class="uni-name-section">
        <label>大学名 <span style="color:var(--accent2)">*</span></label>
        <input type="text" id="f_大学名" placeholder="例: Harvard University" oninput="onNameChange()">
      </div>

      <!-- スコアなし -->
      <div class="no-score-section">
        <label>
          <input type="checkbox" id="f_no_score" onchange="toggleScoreFields()">
          <div class="no-score-label-text">
            スコア提出はあるがスコア条件はなし
            <small>チェックすると数値フィールドが無効になります</small>
          </div>
        </label>
      </div>

      <!-- TOEFL -->
      <div class="test-card">
        <div class="test-card-header">
          <span class="test-label toefl">TOEFL iBT</span>
          <span class="test-range">総合 0–120 / セクション 0–30</span>
        </div>
        <div class="test-card-body">
          <div class="score-grid" id="grid_toefl">
            <div class="score-field total">
              <label>総合</label>
              <input type="number" id="f_TOEFL 総合" min="0" max="120" placeholder="100">
            </div>
            <div class="score-field">
              <label>Reading</label>
              <input type="number" id="f_TOEFL Reading" min="0" max="30" placeholder="22">
            </div>
            <div class="score-field">
              <label>Listening</label>
              <input type="number" id="f_TOEFL Listening" min="0" max="30" placeholder="22">
            </div>
            <div class="score-field">
              <label>Writing</label>
              <input type="number" id="f_TOEFL Writing" min="0" max="30" placeholder="22">
            </div>
            <div class="score-field">
              <label>Speaking</label>
              <input type="number" id="f_TOEFL Speaking" min="0" max="30" placeholder="22">
            </div>
          </div>
        </div>
      </div>

      <!-- IELTS -->
      <div class="test-card">
        <div class="test-card-header">
          <span class="test-label ielts">IELTS</span>
          <span class="test-range">総合 0–9 / セクション 0–9（0.5刻み）</span>
        </div>
        <div class="test-card-body">
          <div class="score-grid" id="grid_ielts">
            <div class="score-field total">
              <label>総合</label>
              <input type="number" id="f_IELTS 総合" min="0" max="9" step="0.5" placeholder="7.0">
            </div>
            <div class="score-field">
              <label>Reading</label>
              <input type="number" id="f_IELTS Reading" min="0" max="9" step="0.5" placeholder="6.5">
            </div>
            <div class="score-field">
              <label>Listening</label>
              <input type="number" id="f_IELTS Listening" min="0" max="9" step="0.5" placeholder="6.5">
            </div>
            <div class="score-field">
              <label>Writing</label>
              <input type="number" id="f_IELTS Writing" min="0" max="9" step="0.5" placeholder="6.5">
            </div>
            <div class="score-field">
              <label>Speaking</label>
              <input type="number" id="f_IELTS Speaking" min="0" max="9" step="0.5" placeholder="6.5">
            </div>
          </div>
        </div>
      </div>

      <!-- Duolingo -->
      <div class="test-card">
        <div class="test-card-header">
          <span class="test-label duolingo">Duolingo English Test</span>
          <span class="test-range">各スコア 10–160</span>
        </div>
        <div class="test-card-body">
          <div class="score-grid" id="grid_duolingo">
            <div class="score-field total">
              <label>総合</label>
              <input type="number" id="f_Duolingo 総合" min="10" max="160" placeholder="120">
            </div>
            <div class="score-field">
              <label>Literacy</label>
              <input type="number" id="f_Duolingo Literacy" min="10" max="160" placeholder="110">
            </div>
            <div class="score-field">
              <label>Comprehension</label>
              <input type="number" id="f_Duolingo Comprehension" min="10" max="160" placeholder="110">
            </div>
            <div class="score-field">
              <label>Conversation</label>
              <input type="number" id="f_Duolingo Conversation" min="10" max="160" placeholder="100">
            </div>
            <div class="score-field">
              <label>Production</label>
              <input type="number" id="f_Duolingo Production" min="10" max="160" placeholder="100">
            </div>
          </div>
        </div>
      </div>

    </div><!-- /form-scroll -->

    <!-- アクションバー -->
    <div class="action-bar">
      <div id="statusMsg"></div>
      <button class="btn btn-delete" id="deleteBtn" onclick="deleteEntry()" style="display:none">削除</button>
      <button class="btn btn-primary" onclick="saveEntry()">追加 / 更新</button>
      <button class="btn btn-danger" onclick="shutdown()">終了</button>
    </div>
  </div>

</div><!-- /layout -->

<script>
// ─── データ ──────────────────────────────────────────────────
let allNames    = []     // 登録済み全大学名
let filtered    = []     // 検索フィルター後
let activeName  = null   // 現在選択中

const NUM_FIELDS = [
  'TOEFL 総合','TOEFL Reading','TOEFL Listening','TOEFL Writing','TOEFL Speaking',
  'IELTS 総合','IELTS Reading','IELTS Listening','IELTS Writing','IELTS Speaking',
  'Duolingo 総合','Duolingo Literacy','Duolingo Comprehension','Duolingo Conversation','Duolingo Production'
]

// ─── 初期化 ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await refreshList()
})

async function refreshList() {
  const res = await fetch('/api/list')
  allNames  = await res.json()
  document.getElementById('totalCount').textContent = allNames.length
  document.getElementById('totalLabel').textContent = `全 ${allNames.length} 件`
  filterList()
}

// ─── 検索フィルター ───────────────────────────────────────────
function filterList() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase()
  filtered = q
    ? allNames.filter(n => n.toLowerCase().includes(q))
    : [...allNames]

  const mc = document.getElementById('matchCount')
  mc.textContent = q ? `${filtered.length} 件一致` : ''

  renderList()
}

function renderList() {
  const container = document.getElementById('uniList')

  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-result">一致する大学が見つかりません</div>'
    return
  }

  // 最大 200 件まで表示（パフォーマンス対策）
  const display = filtered.slice(0, 200)
  const more    = filtered.length - display.length

  container.innerHTML = display.map((name, i) => `
    <div class="uni-item ${name === activeName ? 'active' : ''}" onclick="loadEntry('${escHtml(name)}')">
      <span class="uni-idx">${allNames.indexOf(name) + 1}</span>
      <span>${escHtml(name)}</span>
    </div>
  `).join('') + (more > 0 ? `<div class="no-result">…他 ${more} 件（検索を絞り込んでください）</div>` : '')
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ─── 大学読み込み ─────────────────────────────────────────────
async function loadEntry(name) {
  activeName = name
  renderList()

  const res  = await fetch('/api/load/' + encodeURIComponent(name))
  if (!res.ok) { setStatus('読み込みに失敗しました', true); return }

  const data = await res.json()
  fillForm(data)
  document.getElementById('deleteBtn').style.display = 'inline-flex'
  setStatus(`「${name}」を読み込みました`, false)
}

// ─── 新規入力 ─────────────────────────────────────────────────
function newEntry() {
  activeName = null
  clearForm()
  renderList()
  document.getElementById('deleteBtn').style.display = 'none'
  document.getElementById('f_大学名').focus()
  setStatus('新規入力モード', false)
}

// ─── フォーム操作 ─────────────────────────────────────────────
function fillForm(data) {
  document.getElementById('f_大学名').value = data['大学名'] || ''

  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (!el) return
    el.value = (data[k] != null && data[k] !== '') ? data[k] : ''
  })

  const noScore = !!data['スコア提出はあるがスコア条件はなし']
  document.getElementById('f_no_score').checked = noScore
  toggleScoreFields()
}

function collectForm() {
  const data = {}
  data['大学名'] = (document.getElementById('f_大学名').value || '').trim()

  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (!el) return
    const v = el.value.trim()
    data[k] = v === '' ? null : parseFloat(v)
  })

  data['スコア提出はあるがスコア条件はなし'] = document.getElementById('f_no_score').checked
  return data
}

function clearForm() {
  document.getElementById('f_大学名').value = ''
  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = ''
  })
  document.getElementById('f_no_score').checked = false
  toggleScoreFields()
}

function toggleScoreFields() {
  const disabled = document.getElementById('f_no_score').checked
  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.disabled = disabled
  })
}

function onNameChange() {
  // 名前が変わったら削除ボタンを非表示
  if (activeName && document.getElementById('f_大学名').value.trim() !== activeName) {
    document.getElementById('deleteBtn').style.display = 'none'
  }
}

// ─── API 操作 ─────────────────────────────────────────────────
async function saveEntry() {
  const data = collectForm()
  if (!data['大学名']) { setStatus('大学名を入力してください', true); return }

  setStatus('保存中...', false)
  const res  = await fetch('/api/save', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data)
  })
  const json = await res.json()
  if (json.error) {
    setStatus('⚠ ' + json.error, true)
  } else {
    activeName = data['大学名']
    document.getElementById('deleteBtn').style.display = 'inline-flex'
    setStatus('✅ ' + json.message, false)
    await refreshList()
    // 保存した大学をリストでハイライト
    const q = document.getElementById('searchInput').value.trim().toLowerCase()
    if (!activeName.toLowerCase().includes(q)) {
      document.getElementById('searchInput').value = ''
      filterList()
    }
    renderList()
  }
}

async function deleteEntry() {
  const name = (document.getElementById('f_大学名').value || '').trim()
  if (!name) return
  if (!confirm(`「${name}」を削除しますか？`)) return

  const res  = await fetch('/api/delete', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ '大学名': name })
  })
  const json = await res.json()
  if (json.error) {
    setStatus('⚠ ' + json.error, true)
  } else {
    setStatus('🗑 ' + json.message, false)
    activeName = null
    clearForm()
    document.getElementById('deleteBtn').style.display = 'none'
    await refreshList()
  }
}

async function shutdown() {
  if (!confirm('サーバーを終了しますか？')) return
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#6b7280;">サーバーを終了しました。このタブを閉じてください。</div>'
}

// ─── ユーティリティ ───────────────────────────────────────────
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
