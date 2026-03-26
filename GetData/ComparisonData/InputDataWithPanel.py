"""
InputDataWithPanel.py  ―  大学データ手動入力パネル
===================================================
Common Data Set の数値を入力して JSON に保存する。
左パネル : CDS 参照ガイド
右パネル : 入力フォーム（CDS 順厳守）

使い方:
  python InputDataWithPanel.py
  → ブラウザで http://localhost:5051 を開く

出力先:
  ../CreateTable/input_data.json

依存:
  pip install flask
"""

import json
import os
import threading
from pathlib import Path
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)

HERE        = Path(__file__).parent                       # .../ComparisonData/
OUTPUT_JSON = HERE.parent / "CreateTable" / "input_data.json"


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
    records = load_data()
    return jsonify([r.get("大学名", "") for r in records])


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
    return jsonify({"message": f"「{name}」を削除しました"})


@app.route("/api/shutdown", methods=["POST"])
def api_shutdown():
    threading.Timer(0.4, lambda: os._exit(0)).start()
    return jsonify({"message": "終了します"})


# ─────────────────────────────────────────────
#  HTML テンプレート
# ─────────────────────────────────────────────

HTML = r"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>大学データ入力パネル</title>
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
    --text:     #e8eaf0;
    --muted:    #6b7280;
    --muted2:   #4a4f5e;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 13px;
  }

  /* ── ヘッダー ── */
  .app-header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: 52px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
    gap: 1.5rem;
  }
  .app-header h1 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1rem;
    color: var(--accent);
    white-space: nowrap;
  }
  .uni-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }
  .uni-selector label { color: var(--muted); font-size: 0.7rem; white-space: nowrap; }
  .uni-selector select {
    flex: 1; max-width: 280px;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 5px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.75rem;
    padding: 0.3rem 0.5rem;
    outline: none;
  }
  .uni-selector select:focus { border-color: var(--accent); }

  .hdr-count {
    font-size: 0.7rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .hdr-count span { color: var(--accent3); font-weight: 600; }

  /* ── メインレイアウト ── */
  .layout {
    display: grid;
    grid-template-columns: 310px 1fr;
    height: calc(100vh - 52px);
    margin-top: 52px;
  }

  /* ── 左パネル（CDS 参照）── */
  .left-panel {
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 1rem;
  }
  .left-panel h2 {
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: 0.8rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .ref-section {
    margin-bottom: 1.2rem;
  }
  .ref-section-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .ref-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  .ref-item {
    display: flex;
    gap: 0.5rem;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    transition: background 0.1s;
    cursor: default;
  }
  .ref-item:hover { background: var(--surface2); }
  .ref-item .ref-tag {
    font-size: 0.6rem;
    color: var(--muted2);
    min-width: 26px;
    padding-top: 1px;
    font-family: 'Syne', sans-serif;
  }
  .ref-item .ref-name {
    font-size: 0.72rem;
    color: var(--text);
    line-height: 1.4;
  }
  .ref-item .ref-note {
    font-size: 0.62rem;
    color: var(--muted);
    margin-top: 0.15rem;
    line-height: 1.4;
  }

  /* ── 右パネル（入力フォーム）── */
  .right-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .form-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1.8rem;
    padding-bottom: 0.5rem;
  }

  /* ── フォームセクション ── */
  .form-section {
    margin-bottom: 2rem;
  }
  .form-section-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .form-section-title .cds-tag {
    font-size: 0.58rem;
    background: rgba(91,255,200,0.1);
    border: 1px solid rgba(91,255,200,0.25);
    border-radius: 3px;
    padding: 0.1rem 0.4rem;
    color: var(--accent);
    font-weight: 600;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.8rem 1.2rem;
  }
  .field-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .field-grid.cols-1 { grid-template-columns: 1fr; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .field.full { grid-column: 1 / -1; }

  .field label {
    font-size: 0.65rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    line-height: 1.4;
  }
  .field .field-note {
    font-size: 0.62rem;
    color: var(--muted2);
    line-height: 1.5;
    margin-top: -0.1rem;
  }

  input[type="text"],
  input[type="number"],
  input[type="url"],
  input[type="date"],
  select.field-select {
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 5px;
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    padding: 0.45rem 0.65rem;
    outline: none;
    width: 100%;
    transition: border-color 0.15s;
  }
  input:focus, select.field-select:focus {
    border-color: var(--accent);
  }
  input[type="number"] { -moz-appearance: textfield; }
  input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; }

  /* 種類チェックボックス */
  .checkbox-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.1rem;
  }
  .cb-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--surface2);
    border: 1px solid var(--border2);
    border-radius: 5px;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
  }
  .cb-item:hover { border-color: var(--accent); }
  .cb-item input[type="checkbox"] {
    width: 13px; height: 13px;
    accent-color: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
  }
  .cb-item span {
    font-size: 0.75rem;
    color: var(--text);
    white-space: nowrap;
  }
  .cb-item:has(input:checked) {
    background: rgba(91,255,200,0.08);
    border-color: var(--accent);
  }

  /* 単一チェックボックスフィールド */
  .bool-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: 5px;
    padding: 0.4rem 0.65rem;
    cursor: pointer;
    transition: border-color 0.15s;
    user-select: none;
  }
  .bool-field:has(input:checked) { border-color: var(--accent); background: rgba(91,255,200,0.05); }
  .bool-field input[type="checkbox"] {
    width: 13px; height: 13px;
    accent-color: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
  }
  .bool-field span { font-size: 0.78rem; color: var(--text); }

  /* Deferred Admission 複合フィールド */
  .deferred-wrap {
    display: flex;
    gap: 0.5rem;
  }
  .deferred-wrap input { flex: 1; }
  .deferred-wrap select { width: 110px; flex-shrink: 0; }

  /* ── アクションバー ── */
  .action-bar {
    padding: 0.9rem 1.8rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  #statusMsg {
    flex: 1;
    font-size: 0.72rem;
    color: var(--accent);
    min-height: 1rem;
  }
  #statusMsg.err { color: var(--accent2); }

  .btn {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    border: none;
    border-radius: 6px;
    padding: 0.6rem 1.4rem;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .btn:active { transform: scale(0.97); }
  .btn-primary { background: var(--accent); color: #0d0f14; }
  .btn-primary:hover { opacity: 0.88; }
  .btn-danger  { background: transparent; color: var(--accent2); border: 1px solid var(--accent2); }
  .btn-danger:hover  { background: rgba(255,107,107,0.08); }
  .btn-load    { background: transparent; color: var(--accent3); border: 1px solid var(--accent3); font-size: 0.72rem; padding: 0.4rem 0.9rem; }
  .btn-load:hover { background: rgba(255,200,91,0.08); }
  .btn-delete  { background: transparent; color: var(--muted); border: 1px solid var(--border2); font-size: 0.72rem; padding: 0.4rem 0.9rem; }
  .btn-delete:hover { color: var(--accent2); border-color: var(--accent2); }

  /* スクロールバー */
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--muted2); }
</style>
</head>
<body>

<!-- ── ヘッダー ── -->
<div class="app-header">
  <h1>大学データ入力パネル</h1>
  <div class="uni-selector">
    <label>登録済み：</label>
    <select id="existingSelect" onchange="onSelectChange()">
      <option value="">― 大学を選択して読み込む ―</option>
    </select>
    <button class="btn btn-load" onclick="loadSelected()">読み込む</button>
    <button class="btn btn-delete" onclick="deleteSelected()">削除</button>
  </div>
  <div class="hdr-count">登録数：<span id="countBadge">0</span> 件</div>
</div>

<!-- ── メインレイアウト ── -->
<div class="layout">

  <!-- ── 左パネル（CDS 参照ガイド）── -->
  <div class="left-panel">
    <h2>CDS 参照ガイド</h2>

    <div class="ref-section">
      <div class="ref-section-title">基本情報</div>
      <div class="ref-item"><span class="ref-tag">—</span><div><div class="ref-name">大学名</div></div></div>
      <div class="ref-item"><span class="ref-tag">—</span><div><div class="ref-name">URL</div></div></div>
      <div class="ref-item"><span class="ref-tag">—</span><div><div class="ref-name">種類</div><div class="ref-note">国公立 / 私立 / 総合大学 / リベラルアーツ / 共学 / 男子大 / 女子大</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section B — 学生数</div>
      <div class="ref-item"><span class="ref-tag">B1</span><div><div class="ref-name">学生数</div><div class="ref-note">Undergraduate enrollment (total)</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section C — 入試</div>
      <div class="ref-item"><span class="ref-tag">C1</span><div><div class="ref-name">男性受験者数 / 女性受験者数</div></div></div>
      <div class="ref-item"><span class="ref-tag">C1</span><div><div class="ref-name">男性合格者数 / 女性合格者数</div></div></div>
      <div class="ref-item"><span class="ref-tag">C1</span><div><div class="ref-name">男性入学者数 / 女性入学者数</div></div></div>
      <div class="ref-item"><span class="ref-tag">C1</span><div><div class="ref-name">留学生 出願 / 合格 / 入学</div></div></div>
      <div class="ref-item"><span class="ref-tag">C1</span><div><div class="ref-name">全体 出願 / 合格 / 入学</div></div></div>
      <div class="ref-item"><span class="ref-tag">C8</span><div><div class="ref-name">SAT / ACT 提出割合 (%)</div></div></div>
      <div class="ref-item"><span class="ref-tag">C9</span><div><div class="ref-name">SAT Composite / EBRW / Math</div><div class="ref-note">中央値 or 75th percentile</div></div></div>
      <div class="ref-item"><span class="ref-tag">C10</span><div><div class="ref-name">ACT Composite / Math / Science / Reading</div></div></div>
      <div class="ref-item"><span class="ref-tag">C7</span><div><div class="ref-name">GPA</div><div class="ref-note">Weighted or Unweighted 平均</div></div></div>
      <div class="ref-item"><span class="ref-tag">C7</span><div><div class="ref-name">区間の下限</div><div class="ref-note">下からの和が20%になるレンジの下限値</div></div></div>
      <div class="ref-item"><span class="ref-tag">C7</span><div><div class="ref-name">下限までの累計</div><div class="ref-note">20%レンジ未満の累積%</div></div></div>
      <div class="ref-item"><span class="ref-tag">C7</span><div><div class="ref-name">区間のパーセンテージ</div><div class="ref-note">20%を満たすレンジの%</div></div></div>
      <div class="ref-item"><span class="ref-tag">C3</span><div><div class="ref-name">Priority Date</div></div></div>
      <div class="ref-item"><span class="ref-tag">C3</span><div><div class="ref-name">Deferred Admission</div><div class="ref-note">期間 + Semester / Year</div></div></div>
      <div class="ref-item"><span class="ref-tag">C22</span><div><div class="ref-name">ED 出願 / 合格</div><div class="ref-note">Early Decision</div></div></div>
      <div class="ref-item"><span class="ref-tag">C23</span><div><div class="ref-name">EA 出願 / 合格</div><div class="ref-note">Early Action</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section G — 費用</div>
      <div class="ref-item"><span class="ref-tag">G3</span><div><div class="ref-name">Tuition</div></div></div>
      <div class="ref-item"><span class="ref-tag">G3</span><div><div class="ref-name">Required Fees</div></div></div>
      <div class="ref-item"><span class="ref-tag">G5</span><div><div class="ref-name">Food and housing total</div></div></div>
      <div class="ref-item"><span class="ref-tag">G5</span><div><div class="ref-name">Housing Only / Food Only</div></div></div>
      <div class="ref-item"><span class="ref-tag">G5</span><div><div class="ref-name">Books and supplies</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section H — 経済支援</div>
      <div class="ref-item"><span class="ref-tag">H1</span><div><div class="ref-name">Need 総数 / Need-Met / 平均額</div></div></div>
      <div class="ref-item"><span class="ref-tag">H1</span><div><div class="ref-name">Merit 総数 / 平均額</div></div></div>
      <div class="ref-item"><span class="ref-tag">H2</span><div><div class="ref-name">Need available / non-need / both not</div></div></div>
      <div class="ref-item"><span class="ref-tag">H2B</span><div><div class="ref-name">Need 留学生 総数 / 平均額</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section I — クラスサイズ</div>
      <div class="ref-item"><span class="ref-tag">I1</span><div><div class="ref-name">2–9, 10–19, 20–29, 30–39, 40–49, 50–99, 100+</div><div class="ref-note">各レンジのクラス数（%）</div></div></div>
      <div class="ref-item"><span class="ref-tag">I1</span><div><div class="ref-name">Total</div></div></div>
    </div>

    <div class="ref-section">
      <div class="ref-section-title">Section J — 専攻（Major）</div>
      <div class="ref-item"><span class="ref-tag">J1</span><div><div class="ref-name">38 カテゴリ</div><div class="ref-note">Bachelor's 8% 以上 → TRUE<br>evaluate.py で自動設定も可</div></div></div>
    </div>
  </div>

  <!-- ── 右パネル（入力フォーム）── -->
  <div class="right-panel">
    <div class="form-scroll" id="formScroll">

      <!-- 1. 基本情報 -->
      <div class="form-section">
        <div class="form-section-title">基本情報</div>
        <div class="field-grid cols-1" style="gap:0.8rem;">
          <div class="field full">
            <label>大学名 <span style="color:var(--accent2)">*</span></label>
            <input type="text" id="f_大学名" placeholder="Harvard University">
          </div>
          <div class="field full">
            <label>URL</label>
            <input type="url" id="f_URL" placeholder="https://www.harvard.edu">
          </div>
          <div class="field full">
            <label>種類（複数選択可）</label>
            <div class="checkbox-grid" id="f_種類">
              <label class="cb-item"><input type="checkbox" value="国公立"><span>国公立</span></label>
              <label class="cb-item"><input type="checkbox" value="私立"><span>私立</span></label>
              <label class="cb-item"><input type="checkbox" value="総合大学"><span>総合大学</span></label>
              <label class="cb-item"><input type="checkbox" value="リベラルアーツカレッジ"><span>リベラルアーツカレッジ</span></label>
              <label class="cb-item"><input type="checkbox" value="共学"><span>共学</span></label>
              <label class="cb-item"><input type="checkbox" value="男子大"><span>男子大</span></label>
              <label class="cb-item"><input type="checkbox" value="女子大"><span>女子大</span></label>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 学生数 (Section B) -->
      <div class="form-section">
        <div class="form-section-title">Section B — 学生数 <span class="cds-tag">B1</span></div>
        <div class="field-grid cols-1">
          <div class="field" style="max-width:220px;">
            <label>学生数（Undergrad Total）</label>
            <input type="number" id="f_学生数" placeholder="6700">
          </div>
        </div>
      </div>

      <!-- 3. 入試 男女別 (Section C1) -->
      <div class="form-section">
        <div class="form-section-title">Section C — 入試（男女別）<span class="cds-tag">C1</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>男性 受験者数</label><input type="number" id="f_男性受験者数" placeholder="0"></div>
          <div class="field"><label>男性 合格者数</label><input type="number" id="f_男性合格者数" placeholder="0"></div>
          <div class="field"><label>男性 入学者数</label><input type="number" id="f_男性入学者数" placeholder="0"></div>
          <div class="field"><label>女性 受験者数</label><input type="number" id="f_女性受験者数" placeholder="0"></div>
          <div class="field"><label>女性 合格者数</label><input type="number" id="f_女性合格者数" placeholder="0"></div>
          <div class="field"><label>女性 入学者数</label><input type="number" id="f_女性入学者数" placeholder="0"></div>
        </div>
      </div>

      <!-- 4. 留学生入試 -->
      <div class="form-section">
        <div class="form-section-title">Section C — 留学生入試 <span class="cds-tag">C1</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>留学生 出願者数</label><input type="number" id="f_留学生出願者数" placeholder="0"></div>
          <div class="field"><label>留学生 合格者数</label><input type="number" id="f_留学生合格者数" placeholder="0"></div>
          <div class="field"><label>留学生 入学者数</label><input type="number" id="f_留学生入学者数" placeholder="0"></div>
        </div>
      </div>

      <!-- 5. 全体入試 -->
      <div class="form-section">
        <div class="form-section-title">Section C — 全体入試 <span class="cds-tag">C1</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>全体 出願者数</label><input type="number" id="f_全体出願者数" placeholder="0"></div>
          <div class="field"><label>全体 合格者数</label><input type="number" id="f_全体合格者数" placeholder="0"></div>
          <div class="field"><label>全体 入学者数</label><input type="number" id="f_全体入学者数" placeholder="0"></div>
        </div>
      </div>

      <!-- 6. テストスコア (C8, C9, C10) -->
      <div class="form-section">
        <div class="form-section-title">Section C — 標準化テスト <span class="cds-tag">C8–C10</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>SAT 提出割合 (%)</label><input type="number" id="f_SAT提出割合" placeholder="75" step="0.1"></div>
          <div class="field"><label>ACT 提出割合 (%)</label><input type="number" id="f_ACT提出割合" placeholder="25" step="0.1"></div>
          <div class="field"></div>
          <div class="field"><label>SAT Composite</label><input type="number" id="f_SAT Composite" placeholder="1500"></div>
          <div class="field"><label>SAT EBRW</label><input type="number" id="f_SAT EBRW" placeholder="750"></div>
          <div class="field"><label>SAT Math</label><input type="number" id="f_SAT Math" placeholder="760"></div>
          <div class="field"><label>ACT Composite</label><input type="number" id="f_ACT Composite" placeholder="34"></div>
          <div class="field"><label>ACT Math</label><input type="number" id="f_ACT Math" placeholder="35"></div>
          <div class="field"><label>ACT Science</label><input type="number" id="f_ACT Science" placeholder="35"></div>
          <div class="field"><label>ACT Reading</label><input type="number" id="f_ACT Reading" placeholder="35"></div>
        </div>
      </div>

      <!-- 7. GPA (C7) -->
      <div class="form-section">
        <div class="form-section-title">Section C — GPA <span class="cds-tag">C7</span></div>
        <div class="field-grid">
          <div class="field" style="max-width:220px;">
            <label>GPA（平均・中央値）</label>
            <input type="number" id="f_GPA" placeholder="3.90" step="0.01">
          </div>
          <div class="field"></div>
          <div class="field">
            <label>区間の下限</label>
            <div class="field-note">下からの和が 20% になるレンジの低い数値<br>（例: 3.00 / 3.25 / 3.50 / 3.75）</div>
            <input type="number" id="f_区間の下限" placeholder="3.75" step="0.25">
          </div>
          <div class="field">
            <label>下限までの累計 (%)</label>
            <div class="field-note">20% を満たすレンジ未満の累積 % を入力</div>
            <input type="number" id="f_下限までの累計" placeholder="5.0" step="0.1">
          </div>
          <div class="field">
            <label>区間のパーセンテージ (%)</label>
            <div class="field-note">20% を満たすレンジのパーセンテージを入力</div>
            <input type="number" id="f_区間のパーセンテージ" placeholder="20.0" step="0.1">
          </div>
        </div>
      </div>

      <!-- 8. 入学方式 (C3, C22-25) -->
      <div class="form-section">
        <div class="form-section-title">Section C — 入学方式 <span class="cds-tag">C3 / C22–C25</span></div>
        <div class="field-grid">
          <div class="field">
            <label>Priority Date</label>
            <input type="date" id="f_Priority Date">
          </div>
          <div class="field">
            <label>Deferred Admission（期間 + 単位）</label>
            <div class="deferred-wrap">
              <input type="number" id="f_deferred_value" placeholder="1" min="0">
              <select class="field-select" id="f_deferred_unit">
                <option value="">― 選択 ―</option>
                <option value="Semester">Semester</option>
                <option value="Year">Year</option>
              </select>
            </div>
          </div>
          <div class="field"><label>ED 出願者数</label><input type="number" id="f_ED出願者数" placeholder="0"></div>
          <div class="field"><label>ED 合格者数</label><input type="number" id="f_ED合格者数" placeholder="0"></div>
          <div class="field"><label>EA 出願者数</label><input type="number" id="f_EA出願者数" placeholder="0"></div>
          <div class="field"><label>EA 合格者数</label><input type="number" id="f_EA合格者数" placeholder="0"></div>
        </div>
      </div>

      <!-- 9. 費用 (Section G) -->
      <div class="form-section">
        <div class="form-section-title">Section G — 費用 <span class="cds-tag">G3 / G5</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>Tuition ($)</label><input type="number" id="f_Tuition" placeholder="60000"></div>
          <div class="field"><label>Required Fees ($)</label><input type="number" id="f_Required Fees" placeholder="1000"></div>
          <div class="field"></div>
          <div class="field"><label>Food and Housing Total ($)</label><input type="number" id="f_Food and housing total" placeholder="18000"></div>
          <div class="field"><label>Housing Only ($)</label><input type="number" id="f_Housing Only" placeholder="10000"></div>
          <div class="field"><label>Food Only ($)</label><input type="number" id="f_Food Only" placeholder="8000"></div>
          <div class="field"><label>Books and Supplies ($)</label><input type="number" id="f_Books and supplies" placeholder="1000"></div>
        </div>
      </div>

      <!-- 10. 経済支援 (Section H) -->
      <div class="form-section">
        <div class="form-section-title">Section H — 経済支援（Need / Merit）<span class="cds-tag">H1 / H2</span></div>
        <div class="field-grid cols-3">
          <div class="field"><label>Need 総数</label><input type="number" id="f_Need総数" placeholder="0"></div>
          <div class="field"><label>Need-Met (%)</label><input type="number" id="f_Need-Met" placeholder="100" step="0.1"></div>
          <div class="field"><label>Need 全体平均額 ($)</label><input type="number" id="f_Need全体平均額" placeholder="0"></div>
          <div class="field"><label>Merit 全体数</label><input type="number" id="f_Merit全体数" placeholder="0"></div>
          <div class="field"><label>Merit 平均額 ($)</label><input type="number" id="f_Merit平均額" placeholder="0"></div>
          <div class="field"></div>
        </div>
        <div class="field-grid cols-3" style="margin-top:0.8rem;">
          <div class="field">
            <label>Aid Availability</label>
            <div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.2rem;">
              <label class="bool-field"><input type="checkbox" id="f_Need available"><span>Need available</span></label>
              <label class="bool-field"><input type="checkbox" id="f_non need available"><span>Non-need available</span></label>
              <label class="bool-field"><input type="checkbox" id="f_both not available"><span>Both not available</span></label>
            </div>
          </div>
          <div class="field"><label>Need 留学生 総数</label><input type="number" id="f_Need留学生総数" placeholder="0"></div>
          <div class="field"><label>Need 留学生 平均額 ($)</label><input type="number" id="f_Need留学生平均額" placeholder="0"></div>
        </div>
      </div>

      <!-- 11. クラスサイズ (Section I) -->
      <div class="form-section">
        <div class="form-section-title">Section I — クラスサイズ分布 <span class="cds-tag">I1</span></div>
        <div class="field-grid" style="grid-template-columns:repeat(4,1fr);">
          <div class="field"><label>2–9</label><input type="number" id="f_2-9" placeholder="0"></div>
          <div class="field"><label>10–19</label><input type="number" id="f_10-19" placeholder="0"></div>
          <div class="field"><label>20–29</label><input type="number" id="f_20-29" placeholder="0"></div>
          <div class="field"><label>30–39</label><input type="number" id="f_30-39" placeholder="0"></div>
          <div class="field"><label>40–49</label><input type="number" id="f_40-49" placeholder="0"></div>
          <div class="field"><label>50–99</label><input type="number" id="f_50-99" placeholder="0"></div>
          <div class="field"><label>100+</label><input type="number" id="f_100+" placeholder="0"></div>
          <div class="field"><label>Total</label><input type="number" id="f_Total" placeholder="0"></div>
        </div>
      </div>

      <!-- 12. 専攻 (Section J) -->
      <div class="form-section">
        <div class="form-section-title">Section J — 専攻（Major）<span class="cds-tag">J1</span></div>
        <div class="field-note" style="margin-bottom:0.8rem;">Bachelor's 割合が 8% 以上のものにチェック。<br>evaluate.py でコピペ自動判定も可。</div>
        <div class="checkbox-grid" id="f_majors">
          <label class="cb-item"><input type="checkbox" value="Agriculture"><span>Agriculture</span></label>
          <label class="cb-item"><input type="checkbox" value="Natural resources and conservation"><span>Natural resources and conservation</span></label>
          <label class="cb-item"><input type="checkbox" value="Architecture"><span>Architecture</span></label>
          <label class="cb-item"><input type="checkbox" value="Area, ethnic, and gender studies"><span>Area, ethnic, and gender studies</span></label>
          <label class="cb-item"><input type="checkbox" value="Communication/journalism"><span>Communication/journalism</span></label>
          <label class="cb-item"><input type="checkbox" value="Communication technologies"><span>Communication technologies</span></label>
          <label class="cb-item"><input type="checkbox" value="Computer and information sciences"><span>Computer and information sciences</span></label>
          <label class="cb-item"><input type="checkbox" value="Personal and culinary services"><span>Personal and culinary services</span></label>
          <label class="cb-item"><input type="checkbox" value="Education"><span>Education</span></label>
          <label class="cb-item"><input type="checkbox" value="Engineering"><span>Engineering</span></label>
          <label class="cb-item"><input type="checkbox" value="Engineering technologies"><span>Engineering technologies</span></label>
          <label class="cb-item"><input type="checkbox" value="Foreign languages, literatures, and linguistics"><span>Foreign languages, literatures, and linguistics</span></label>
          <label class="cb-item"><input type="checkbox" value="Family and consumer sciences"><span>Family and consumer sciences</span></label>
          <label class="cb-item"><input type="checkbox" value="Law/legal studies"><span>Law/legal studies</span></label>
          <label class="cb-item"><input type="checkbox" value="English"><span>English</span></label>
          <label class="cb-item"><input type="checkbox" value="Liberal arts/general studies"><span>Liberal arts/general studies</span></label>
          <label class="cb-item"><input type="checkbox" value="Library science"><span>Library science</span></label>
          <label class="cb-item"><input type="checkbox" value="Biological/life sciences"><span>Biological/life sciences</span></label>
          <label class="cb-item"><input type="checkbox" value="Mathematics and statistics"><span>Mathematics and statistics</span></label>
          <label class="cb-item"><input type="checkbox" value="Military science and military technologies"><span>Military science and military technologies</span></label>
          <label class="cb-item"><input type="checkbox" value="Interdisciplinary studies"><span>Interdisciplinary studies</span></label>
          <label class="cb-item"><input type="checkbox" value="Parks and recreation"><span>Parks and recreation</span></label>
          <label class="cb-item"><input type="checkbox" value="Philosophy and religious studies"><span>Philosophy and religious studies</span></label>
          <label class="cb-item"><input type="checkbox" value="Theology and religious vocations"><span>Theology and religious vocations</span></label>
          <label class="cb-item"><input type="checkbox" value="Physical sciences"><span>Physical sciences</span></label>
          <label class="cb-item"><input type="checkbox" value="Science technologies"><span>Science technologies</span></label>
          <label class="cb-item"><input type="checkbox" value="Psychology"><span>Psychology</span></label>
          <label class="cb-item"><input type="checkbox" value="Homeland Security, law enforcement, firefighting, and protective services"><span>Homeland Security, law enforcement, firefighting, and protective services</span></label>
          <label class="cb-item"><input type="checkbox" value="Public administration and social services"><span>Public administration and social services</span></label>
          <label class="cb-item"><input type="checkbox" value="Social sciences"><span>Social sciences</span></label>
          <label class="cb-item"><input type="checkbox" value="Construction trades"><span>Construction trades</span></label>
          <label class="cb-item"><input type="checkbox" value="Mechanic and repair technologies"><span>Mechanic and repair technologies</span></label>
          <label class="cb-item"><input type="checkbox" value="Precision production"><span>Precision production</span></label>
          <label class="cb-item"><input type="checkbox" value="Transportation and materials moving"><span>Transportation and materials moving</span></label>
          <label class="cb-item"><input type="checkbox" value="Visual and performing arts"><span>Visual and performing arts</span></label>
          <label class="cb-item"><input type="checkbox" value="Health professions and related programs"><span>Health professions and related programs</span></label>
          <label class="cb-item"><input type="checkbox" value="Business/marketing"><span>Business/marketing</span></label>
          <label class="cb-item"><input type="checkbox" value="History"><span>History</span></label>
        </div>
      </div>

    </div><!-- /form-scroll -->

    <!-- ── アクションバー ── -->
    <div class="action-bar">
      <div id="statusMsg"></div>
      <button class="btn btn-primary" onclick="addData()">追加 / 更新</button>
      <button class="btn btn-danger" onclick="shutdown()">終了</button>
    </div>
  </div><!-- /right-panel -->

</div><!-- /layout -->

<script>
// ─── 初期化 ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  refreshList()
})

async function refreshList() {
  const res  = await fetch('/api/list')
  const list = await res.json()
  const sel  = document.getElementById('existingSelect')
  const cur  = sel.value
  sel.innerHTML = '<option value="">― 大学を選択して読み込む ―</option>'
  list.forEach(name => {
    const opt = document.createElement('option')
    opt.value = name
    opt.textContent = name
    sel.appendChild(opt)
  })
  if (cur) sel.value = cur
  document.getElementById('countBadge').textContent = list.length
}

// ─── フォーム ↔ JSON 変換 ───────────────────────────────────
const NUM_FIELDS = [
  '学生数','男性受験者数','女性受験者数','男性合格者数','女性合格者数',
  '男性入学者数','女性入学者数','留学生出願者数','留学生合格者数','留学生入学者数',
  '全体出願者数','全体合格者数','全体入学者数',
  'SAT提出割合','ACT提出割合',
  'SAT Composite','SAT EBRW','SAT Math',
  'ACT Composite','ACT Math','ACT Science','ACT Reading',
  'GPA','区間の下限','下限までの累計','区間のパーセンテージ',
  'ED出願者数','ED合格者数','EA出願者数','EA合格者数',
  'Tuition','Required Fees','Food and housing total','Housing Only','Food Only','Books and supplies',
  'Need総数','Need-Met','Need全体平均額','Merit全体数','Merit平均額',
  'Need留学生総数','Need留学生平均額',
  '2-9','10-19','20-29','30-39','40-49','50-99','100+','Total'
]
const TEXT_FIELDS  = ['大学名','URL']
const BOOL_FIELDS  = ['Need available','non need available','both not available']
const DATE_FIELDS  = ['Priority Date']
const MAJOR_FIELDS = [
  'Agriculture','Natural resources and conservation','Architecture',
  'Area, ethnic, and gender studies','Communication/journalism','Communication technologies',
  'Computer and information sciences','Personal and culinary services','Education',
  'Engineering','Engineering technologies','Foreign languages, literatures, and linguistics',
  'Family and consumer sciences','Law/legal studies','English',
  'Liberal arts/general studies','Library science','Biological/life sciences',
  'Mathematics and statistics','Military science and military technologies',
  'Interdisciplinary studies','Parks and recreation','Philosophy and religious studies',
  'Theology and religious vocations','Physical sciences','Science technologies',
  'Psychology','Homeland Security, law enforcement, firefighting, and protective services',
  'Public administration and social services','Social sciences','Construction trades',
  'Mechanic and repair technologies','Precision production','Transportation and materials moving',
  'Visual and performing arts','Health professions and related programs','Business/marketing','History'
]

function collectForm() {
  const data = {}

  TEXT_FIELDS.forEach(k => {
    data[k] = (document.getElementById('f_' + k)?.value || '').trim()
  })

  // 種類（チェックボックス配列）
  const checked = [...document.querySelectorAll('#f_種類 input:checked')].map(cb => cb.value)
  data['種類'] = checked

  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (!el) return
    const v = el.value.trim()
    data[k] = v === '' ? null : parseFloat(v)
  })

  BOOL_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    data[k] = el ? el.checked : false
  })

  DATE_FIELDS.forEach(k => {
    data[k] = (document.getElementById('f_' + k)?.value || '') || null
  })

  // 専攻（Major）チェックボックス
  MAJOR_FIELDS.forEach(k => {
    const cb = [...document.querySelectorAll('#f_majors input')].find(el => el.value === k)
    data[k] = cb ? cb.checked : false
  })

  // Deferred Admission
  const dv = document.getElementById('f_deferred_value').value.trim()
  const du = document.getElementById('f_deferred_unit').value
  data['Deferred Admission'] = (dv && du) ? `${dv} ${du}` : (dv || null)

  return data
}

function fillForm(data) {
  TEXT_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = data[k] || ''
  })

  // 種類
  const typs = data['種類'] || []
  document.querySelectorAll('#f_種類 input').forEach(cb => {
    cb.checked = typs.includes(cb.value)
  })

  NUM_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (!el) return
    el.value = (data[k] != null && data[k] !== '') ? data[k] : ''
  })

  BOOL_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.checked = !!data[k]
  })

  DATE_FIELDS.forEach(k => {
    const el = document.getElementById('f_' + k)
    if (el) el.value = data[k] || ''
  })

  // 専攻（Major）チェックボックス
  MAJOR_FIELDS.forEach(k => {
    const cb = [...document.querySelectorAll('#f_majors input')].find(el => el.value === k)
    if (cb) cb.checked = !!data[k]
  })

  // Deferred Admission
  const da = data['Deferred Admission'] || ''
  const parts = da.split(' ')
  document.getElementById('f_deferred_value').value = parts[0] || ''
  document.getElementById('f_deferred_unit').value  = parts[1] || ''
}

function clearForm() {
  [...document.querySelectorAll('#formScroll input, #formScroll select')]
    .forEach(el => {
      if (el.type === 'checkbox') el.checked = false
      else el.value = ''
    })
}

// ─── API 操作 ────────────────────────────────────────────────
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
  if (json.error) { setStatus('⚠ ' + json.error, true); return }

  setStatus('✅ ' + json.message, false)
  await refreshList()

  // セレクトを追加した大学に合わせる
  document.getElementById('existingSelect').value = data['大学名']
}

async function loadSelected() {
  const name = document.getElementById('existingSelect').value
  if (!name) { setStatus('大学を選択してください', true); return }

  setStatus('読み込み中...', false)
  const res = await fetch('/api/load/' + encodeURIComponent(name))
  if (!res.ok) { setStatus('⚠ 読み込みに失敗しました', true); return }

  const data = await res.json()
  fillForm(data)
  setStatus(`「${name}」を読み込みました`, false)
}

async function deleteSelected() {
  const name = document.getElementById('existingSelect').value
  if (!name) { setStatus('削除する大学を選択してください', true); return }
  if (!confirm(`「${name}」を削除しますか？`)) return

  const res  = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ '大学名': name }),
  })
  const json = await res.json()
  if (json.error) { setStatus('⚠ ' + json.error, true); return }

  setStatus('🗑 ' + json.message, false)
  clearForm()
  document.getElementById('existingSelect').value = ''
  await refreshList()
}

function onSelectChange() {
  // セレクト変更時に自動で読み込む
  const name = document.getElementById('existingSelect').value
  if (name) loadSelected()
}

async function shutdown() {
  if (!confirm('サーバーを終了してウィンドウを閉じますか？')) return
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {})
  window.close()
}

// ─── ステータス表示 ──────────────────────────────────────────
function setStatus(msg, isErr) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className = isErr ? 'err' : ''
}
</script>
</body>
</html>
"""


# ─────────────────────────────────────────────
#  起動
# ─────────────────────────────────────────────

if __name__ == "__main__":
    records = load_data()
    print("=" * 56)
    print("  大学データ入力パネル")
    print("  http://localhost:5051")
    print(f"  出力先: {OUTPUT_JSON}")
    print(f"  登録済み: {len(records)} 件")
    print("=" * 56)
    app.run(port=5051, debug=False)
