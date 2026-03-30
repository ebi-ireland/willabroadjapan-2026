"""
otherConditions.py  ―  大学その他条件 入力パネル
=================================================
奨学金・学生構成・アクセス・キャンパス設備の条件を入力して JSON に保存する。
左パネル: 大学検索 + 一覧  /  右パネル: 入力フォーム

使い方:
  python otherConditions.py
  → ブラウザで http://localhost:5053 を開く

出力先:
  ../CreateTable/other_conditions.json

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
OUTPUT_JSON = HERE.parent / "CreateTable" / "other_conditions.json"

# 他の2パネルのJSON（新規追加時に空エントリを同期）
OTHER_JSONS = [
    HERE.parent / "CreateTable" / "input_data.json",
    HERE.parent / "CreateTable" / "english_proficiency.json",
]


# ── JSON ユーティリティ ──────────────────────────────────────

def load_data() -> list[dict]:
    if OUTPUT_JSON.exists():
        with open(OUTPUT_JSON, encoding="utf-8") as f:
            return json.load(f)
    return []


def save_data(records: list[dict]):
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


# ── Flask ルート ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template_string(HTML)


@app.route("/api/list")
def api_list():
    return jsonify([r.get("大学名", "") for r in load_data()])


@app.route("/api/load/<path:name>")
def api_load(name):
    for r in load_data():
        if r.get("大学名", "") == name:
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
    def _stop():
        os._exit(0)
    threading.Timer(0.5, _stop).start()
    return jsonify({"message": "サーバーを終了します"})


# ── HTML ─────────────────────────────────────────────────────

HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Other Conditions Panel</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;700;800&display=swap');

  :root {
    --bg:        #0d0f14;
    --surface:   #161920;
    --surface2:  #1c2028;
    --border:    #252830;
    --border2:   #2e3240;
    --accent:    #5bffc8;
    --accent2:   #ff6b6b;
    --text:      #e8eaf0;
    --muted:     #6b7280;
    --muted2:    #4b5260;
    --topbar-h:  48px;
    --sidebar-w: 210px;
    --actionbar-h: 56px;
    --c-scholarship: #c084fc;
    --c-student:     #60a5fa;
    --c-access:      #34d399;
    --c-campus:      #fb923c;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 14px;
  }

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
  .top-bar .count-badge { margin-left: auto; font-size: 0.65rem; color: var(--muted); white-space: nowrap; }
  .top-bar .count-badge span { color: var(--accent); font-weight: 600; }

  .left-panel {
    position: fixed;
    top: var(--topbar-h);
    left: 0; bottom: 0;
    width: var(--sidebar-w);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 100;
  }
  .search-box {
    padding: 0.6rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .search-box input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.78rem;
    padding: 0.45rem 0.6rem;
    outline: none;
  }
  .search-box input:focus { border-color: var(--accent); }
  .search-meta {
    padding: 0.35rem 0.6rem;
    font-size: 0.62rem;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .new-btn {
    width: calc(100% - 1.2rem);
    margin: 0.5rem 0.6rem;
    padding: 0.4rem;
    background: transparent;
    border: 1px dashed var(--border2);
    border-radius: 6px;
    color: var(--muted);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .new-btn:hover { border-color: var(--accent); color: var(--accent); }
  .uni-list { flex: 1; overflow-y: auto; padding: 0.3rem 0; }
  .uni-item {
    padding: 0.45rem 0.8rem;
    font-size: 0.72rem;
    color: var(--muted);
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    border-left: 2px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uni-item:hover { background: var(--surface2); color: var(--text); }
  .uni-item.active { background: var(--surface2); color: var(--accent); border-left-color: var(--accent); }
  .empty-list { padding: 1rem 0.8rem; font-size: 0.7rem; color: var(--muted2); text-align: center; }

  .main-content {
    margin-left: var(--sidebar-w);
    margin-top: var(--topbar-h);
    margin-bottom: var(--actionbar-h);
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .uni-name-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.8rem 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .uni-name-label {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.72rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .uni-name-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.92rem;
    padding: 0.45rem 0.7rem;
    outline: none;
  }
  .uni-name-input:focus { border-color: var(--accent); }

  .section-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 1rem;
    border-bottom: 1px solid var(--border);
  }
  .section-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .section-title {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.8rem;
    letter-spacing: 0.03em;
  }
  .section-body {
    padding: 0.8rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .check-grid {
    display: grid;
    gap: 0.15rem;
  }
  .check-grid.cols-2 { grid-template-columns: 1fr 1fr; }
  .check-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }

  .check-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.35rem 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
  }
  .check-row:hover { background: var(--surface2); }
  .check-row input[type="checkbox"] { display: none; }
  .custom-check {
    width: 16px; height: 16px;
    border: 1px solid var(--border2);
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    font-size: 10px;
    color: transparent;
  }
  .check-row input:checked + .custom-check {
    background: var(--accent);
    border-color: var(--accent);
    color: #0d0f14;
  }
  .check-label { font-size: 0.8rem; color: var(--text); }

  .field-row {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.25rem 0.5rem;
  }
  .field-row label { font-size: 0.75rem; color: var(--muted); flex: 1; }
  .field-row input[type="number"] {
    width: 90px;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.88rem;
    padding: 0.4rem 0.65rem;
    outline: none;
    text-align: right;
    -moz-appearance: textfield;
    flex-shrink: 0;
  }
  .field-row input[type="number"]::-webkit-outer-spin-button,
  .field-row input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }
  .field-row input[type="text"] {
    flex: 1;
    max-width: 280px;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 6px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.85rem;
    padding: 0.4rem 0.65rem;
    outline: none;
  }
  .field-row input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(91,255,200,0.12); }
  .field-unit { font-size: 0.7rem; color: var(--muted); white-space: nowrap; }

  .action-bar {
    position: fixed;
    bottom: 0;
    left: var(--sidebar-w); right: 0;
    height: var(--actionbar-h);
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0 1.4rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 100;
  }
  .btn-add {
    padding: 0.5rem 1.6rem;
    background: var(--accent);
    color: #0d0f14;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 0.85rem;
    border: none; border-radius: 7px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .btn-add:hover  { opacity: 0.88; }
  .btn-add:active { transform: scale(0.97); }
  .btn-exit {
    padding: 0.5rem 1.2rem;
    background: transparent;
    color: var(--muted);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.82rem;
    border: 1px solid var(--border2);
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-exit:hover { border-color: var(--accent2); color: var(--accent2); }
  .btn-delete {
    padding: 0.5rem 1rem;
    background: transparent;
    color: var(--muted2);
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.78rem;
    border: 1px solid var(--border);
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.15s;
    margin-left: auto;
  }
  .btn-delete:hover { border-color: var(--accent2); color: var(--accent2); }
  #statusMsg {
    font-size: 0.72rem;
    flex: 1;
    text-align: center;
    color: var(--accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #statusMsg.err { color: var(--accent2); }
</style>
</head>
<body>

<!-- Top bar -->
<div class="top-bar">
  <h1>Other Conditions Panel</h1>
  <span class="subtitle">奨学金・学生構成・アクセス・設備 を登録</span>
  <div class="count-badge">登録済み <span id="totalCount">0</span> 件</div>
</div>

<!-- Left panel -->
<div class="left-panel">
  <div class="search-box">
    <input type="text" id="searchBox" placeholder="🔍 大学名で検索..."
      oninput="filterList()">
  </div>
  <div class="search-meta" id="matchCount">全 0 件</div>
  <button class="new-btn" onclick="newEntry()">+ 新規入力</button>
  <div class="uni-list" id="uniList">
    <div class="empty-list">登録済みの大学はありません</div>
  </div>
</div>

<!-- Main content -->
<div class="main-content">

  <!-- 大学名 -->
  <div class="uni-name-card">
    <span class="uni-name-label">大学名</span>
    <input type="text" class="uni-name-input" id="f_大学名"
      placeholder="例: Harvard University">
  </div>

  <!-- 1. 奨学金 -->
  <div class="section-card">
    <div class="section-header">
      <div class="section-dot" style="background:var(--c-scholarship)"></div>
      <span class="section-title" style="color:var(--c-scholarship)">奨学金</span>
    </div>
    <div class="section-body">
      <div class="check-grid cols-2">
        <label class="check-row">
          <input type="checkbox" id="f_全額免除奨学金">
          <div class="custom-check">✓</div>
          <span class="check-label">全額免除奨学金</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_授業料免除奨学金">
          <div class="custom-check">✓</div>
          <span class="check-label">授業料免除奨学金</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_日本の全財団奨学生の進学した大学">
          <div class="custom-check">✓</div>
          <span class="check-label">日本の全財団奨学生の進学した大学</span>
        </label>
      </div>
      <div class="field-row">
        <label>奨学金が反映される出願締め切り月</label>
        <input type="number" id="f_奨学金が反映される出願締め切り月"
          min="1" max="12" placeholder="11">
        <span class="field-unit">月</span>
      </div>
      <div class="field-row">
        <label>大学入試最終出願締め切り月</label>
        <input type="number" id="f_大学入試最終出願締め切り月"
          min="1" max="12" placeholder="1">
        <span class="field-unit">月</span>
      </div>
    </div>
  </div>

  <!-- 2. 学生構成 -->
  <div class="section-card">
    <div class="section-header">
      <div class="section-dot" style="background:var(--c-student)"></div>
      <span class="section-title" style="color:var(--c-student)">学生構成</span>
    </div>
    <div class="section-body">
      <div class="check-grid cols-2">
        <label class="check-row">
          <input type="checkbox" id="f_学部生のみ">
          <div class="custom-check">✓</div>
          <span class="check-label">学部生のみ</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_大学院生もいるがかなり少ない">
          <div class="custom-check">✓</div>
          <span class="check-label">大学院生もいるがかなり少ない</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_大学院生の割合が多い">
          <div class="custom-check">✓</div>
          <span class="check-label">大学院生の割合が多い</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_PhD課程あり">
          <div class="custom-check">✓</div>
          <span class="check-label">PhD課程あり</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_研究型大学">
          <div class="custom-check">✓</div>
          <span class="check-label">研究型大学</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_日本人学生が10人以下の大学">
          <div class="custom-check">✓</div>
          <span class="check-label">日本人学生が10人以下の大学</span>
        </label>
      </div>
      <div class="field-row">
        <label>大学群・ラベリングのある大学（名称）</label>
        <input type="text" id="f_大学群・ラベリングのある大学"
          placeholder="例: Ivy League, UC系列, Little Ivies">
      </div>
    </div>
  </div>

  <!-- 3. アクセス -->
  <div class="section-card">
    <div class="section-header">
      <div class="section-dot" style="background:var(--c-access)"></div>
      <span class="section-title" style="color:var(--c-access)">アクセス</span>
    </div>
    <div class="section-body">
      <div class="check-grid cols-2">
        <label class="check-row">
          <input type="checkbox" id="f_日本からの直行便がある">
          <div class="custom-check">✓</div>
          <span class="check-label">日本からの直行便がある</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_空港から公共交通で90分圏内">
          <div class="custom-check">✓</div>
          <span class="check-label">空港から公共交通で90分圏内</span>
        </label>
      </div>
      <div class="field-row">
        <label>公共交通2時間圏内に大都市あり（都市名）</label>
        <input type="text" id="f_公共交通2時間圏内に大都市あり"
          placeholder="例: Boston, New York">
      </div>
    </div>
  </div>

  <!-- 4. キャンパス設備 -->
  <div class="section-card">
    <div class="section-header">
      <div class="section-dot" style="background:var(--c-campus)"></div>
      <span class="section-title" style="color:var(--c-campus)">キャンパス設備</span>
    </div>
    <div class="section-body">
      <div class="check-grid cols-3">
        <label class="check-row">
          <input type="checkbox" id="f_学生福祉（バス無料など）">
          <div class="custom-check">✓</div>
          <span class="check-label">学生福祉（バス無料など）</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_ウーバーや配車サービスあり">
          <div class="custom-check">✓</div>
          <span class="check-label">ウーバーや配車サービスあり</span>
        </label>
        <label class="check-row">
          <input type="checkbox" id="f_24時間図書館あり">
          <div class="custom-check">✓</div>
          <span class="check-label">24時間図書館あり</span>
        </label>
      </div>
    </div>
  </div>

</div>

<!-- Action bar -->
<div class="action-bar">
  <button class="btn-add" onclick="addData()">追加 / 更新</button>
  <button class="btn-exit" onclick="shutdown()">終了</button>
  <span id="statusMsg"></span>
  <button class="btn-delete" onclick="deleteData()">削除</button>
</div>

<script>
const CHECKBOX_FIELDS = [
  '全額免除奨学金', '授業料免除奨学金', '日本の全財団奨学生の進学した大学',
  '学部生のみ', '大学院生もいるがかなり少ない', '大学院生の割合が多い',
  'PhD課程あり', '研究型大学', '日本人学生が10人以下の大学',
  '日本からの直行便がある', '空港から公共交通で90分圏内',
  '学生福祉（バス無料など）', 'ウーバーや配車サービスあり', '24時間図書館あり',
]
const NUMBER_FIELDS = [
  '奨学金が反映される出願締め切り月', '大学入試最終出願締め切り月',
]
const TEXT_FIELDS = [
  '大学群・ラベリングのある大学', '公共交通2時間圏内に大都市あり',
]

let allNames   = []
let activeName = null

window.addEventListener('DOMContentLoaded', async () => {
  await refreshList()
})

async function refreshList() {
  const res = await fetch('/api/list')
  allNames  = await res.json()
  document.getElementById('totalCount').textContent = allNames.length
  filterList()
}

function filterList() {
  const q = document.getElementById('searchBox').value.trim().toLowerCase()
  const filtered = q ? allNames.filter(n => n.toLowerCase().includes(q)) : allNames
  document.getElementById('matchCount').textContent = `全 ${filtered.length} 件`
  renderList(filtered)
}

function renderList(names) {
  const el = document.getElementById('uniList')
  if (!names.length) {
    el.innerHTML = '<div class="empty-list">一致する大学が見つかりません</div>'
    return
  }
  el.innerHTML = names.map(n => `
    <div class="uni-item ${n === activeName ? 'active' : ''}"
         onclick="loadUni('${n.replace(/'/g,"\\'")}')">
      ${n}
    </div>`).join('')
}

async function loadUni(name) {
  const res  = await fetch('/api/load/' + encodeURIComponent(name))
  const data = await res.json()
  activeName = name
  fillForm(data)
  filterList()
}

function newEntry() {
  activeName = null
  clearForm()
  renderList(allNames)
  document.getElementById('f_大学名').focus()
}

function fillForm(data) {
  document.getElementById('f_大学名').value = data['大学名'] || ''
  CHECKBOX_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.checked = !!data[k]
  })
  NUMBER_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = (data[k] != null && data[k] !== '') ? data[k] : ''
  })
  TEXT_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = data[k] || ''
  })
}

function clearForm() {
  document.getElementById('f_大学名').value = ''
  CHECKBOX_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.checked = false
  })
  NUMBER_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = ''
  })
  TEXT_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = ''
  })
}

function collectForm() {
  const data = {}
  data['大学名'] = document.getElementById('f_大学名').value.trim()
  CHECKBOX_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) data[k] = el.checked
  })
  NUMBER_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) {
      const v = parseInt(el.value, 10)
      data[k] = isNaN(v) ? null : v
    }
  })
  TEXT_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) data[k] = el.value.trim() || null
  })
  return data
}

async function addData() {
  const data = collectForm()
  if (!data['大学名']) { setStatus('大学名を入力してください', true); return }
  setStatus('保存中...', false)
  const res  = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (res.ok) {
    activeName = data['大学名']
    await refreshList()
    setStatus('✅ ' + json.message, false)
  } else {
    setStatus('⚠ ' + json.error, true)
  }
}

async function deleteData() {
  const name = document.getElementById('f_大学名').value.trim() || activeName
  if (!name) { setStatus('大学名を確認してください', true); return }
  if (!confirm(`「${name}」を削除しますか？`)) return
  const res  = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ '大学名': name }),
  })
  const json = await res.json()
  if (res.ok) {
    activeName = null
    clearForm()
    await refreshList()
    setStatus('🗑 ' + json.message, false)
  } else {
    setStatus('⚠ ' + json.error, true)
  }
}

async function shutdown() {
  if (!confirm('サーバーを終了しますか？')) return
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#6b7280;font-family:monospace;">サーバーを終了しました。このタブを閉じてください。</div>'
}

function setStatus(msg, isErr) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className = isErr ? 'err' : ''
}
</script>
</body>
</html>
"""

if __name__ == "__main__":
    count = len(load_data())
    print("=" * 55)
    print("  Other Conditions Panel")
    print("  http://localhost:5053")
    print(f"  出力先: {OUTPUT_JSON}")
    print(f"  登録済み: {count} 件")
    print("=" * 55)
    app.run(port=5053, debug=False)
