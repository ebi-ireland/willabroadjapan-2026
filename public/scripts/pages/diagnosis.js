// =====================
// diagnosis.js
// パス: /public/scripts/pages/diagnosis.js
// 使用: /public/student-japan/diagnosis.html
// 用途: 大学合格診断ページ
// =====================

const path = window.location.pathname
if (path === '/student-japan/diagnosis.html') {

  let UNIV_DATA = []
  let KW_DATA = []
  let selectedUnivIds = []
  let currentStep = 1

  async function loadData() {
    const [colleges, keywords, scoringRows, config] = await Promise.all([
      fetch('/api/diagnosis/colleges').then(r => r.json()),
      fetch('/api/diagnosis/keywords').then(r => r.json()),
      fetch('/api/diagnosis/scoring').then(r => r.json()),
      fetch('/api/diagnosis/config').then(r => r.json()),
    ])
    UNIV_DATA = colleges.map(u => ({
      id: u.id,
      name: u.name,
      score: u.score,
      needBased: !!u.need_based,
    }))
    KW_DATA = keywords
    SCORING = buildScoringFromAPI(scoringRows)
    DIAGNOSIS_CONFIG = {
      pass_threshold:   parseInt(config.pass_threshold   || 90),
      maybe_threshold:  parseInt(config.maybe_threshold  || 70),
      max_selections:   parseInt(config.max_selections   || 5),
      // 重み係数
      weight_gpa:       parseFloat(config.weight_gpa       || 1.0),
      weight_sat:       parseFloat(config.weight_sat       || 1.0),
      weight_act:       parseFloat(config.weight_act       || 1.0),
      weight_lang:      parseFloat(config.weight_lang      || 1.0),
      weight_classrank: parseFloat(config.weight_classrank || 1.0),
      weight_keywords:  parseFloat(config.weight_keywords  || 1.0),
      // 上限pts（0 = 無制限）
      cap_gpa:          parseInt(config.cap_gpa        || 0),
      cap_sat:          parseInt(config.cap_sat        || 0),
      cap_lang:         parseInt(config.cap_lang       || 0),
      cap_classrank:    parseInt(config.cap_classrank  || 0),
      cap_keywords:     parseInt(config.cap_keywords   || 0),
    }
    renderStepIndicator()
    updateLangInput()
  }

  function renderStepIndicator() {
    const labels = ['スコア入力', '大学選択', '診断結果']
    const cont = document.getElementById('stepIndicator')
    if (!cont) return
    cont.innerHTML = ''
    labels.forEach((lbl, i) => {
      const num = i + 1
      const isDone   = currentStep > num
      const isActive = currentStep === num
      const circleClass = isDone ? 'done' : (isActive ? 'active' : '')
      const labelClass  = isActive ? 'active' : ''
      if (i > 0) {
        const line = document.createElement('div')
        line.className = 'step-line' + (isDone ? ' done' : '')
        cont.appendChild(line)
      }
      const item = document.createElement('div')
      item.className = 'step-item'
      item.innerHTML = `
        <div class="step-circle ${circleClass}">${isDone ? '✓' : num}</div>
        <span class="step-label ${labelClass}">${lbl}</span>
      `
      cont.appendChild(item)
    })
  }

  function goToStep1() {
    currentStep = 1
    document.getElementById('step1').style.display = 'block'
    document.getElementById('step2').style.display = 'none'
    document.getElementById('step3').style.display = 'none'
    renderStepIndicator()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goToStep2() {
    currentStep = 2
    document.getElementById('step1').style.display = 'none'
    document.getElementById('step2').style.display = 'block'
    document.getElementById('step3').style.display = 'none'
    renderUnivSelector()
    renderStepIndicator()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetAll() {
    selectedUnivIds = []
    currentStep = 1
    document.getElementById('in_gpa').value = ''
    document.getElementById('in_sat').value = ''
    document.getElementById('in_act').value = ''
    document.getElementById('in_lang').value = ''
    document.getElementById('act1').value = ''
    document.getElementById('act2').value = ''
    document.getElementById('act3').value = ''
    document.getElementById('in_classrank').value = ''
    document.querySelector('input[name="langType"][value="none"]').checked = true
    document.querySelector('input[name="needBased"][value="no"]').checked = true
    updateLangInput()
    goToStep1()
  }

  function updateLangInput() {
    const type = document.querySelector('input[name="langType"]:checked')?.value || 'none'
    const wrap  = document.getElementById('langScoreWrap')
    const label = document.getElementById('langScoreLabel')
    const hint  = document.getElementById('langScoreHint')
    const input = document.getElementById('in_lang')
    if (!wrap) return
    if (type === 'none') { wrap.style.display = 'none'; return }
    wrap.style.display = 'block'
    const map = {
      toefl:    { label: 'TOEFL iBT スコア', hint: '0〜120',  min: 0,  max: 120, step: 1   },
      ielts:    { label: 'IELTS スコア',      hint: '0〜9.0', min: 0,  max: 9.0, step: 0.5 },
      duolingo: { label: 'Duolingo スコア',   hint: '10〜160',min: 10, max: 160, step: 1   },
    }
    const m = map[type]
    label.textContent = m.label
    hint.textContent  = m.hint
    input.min  = m.min
    input.max  = m.max
    input.step = m.step
    input.placeholder = type === 'toefl' ? '例: 100' : type === 'ielts' ? '例: 7.0' : '例: 110'
  }

  let SCORING = {}
  let DIAGNOSIS_CONFIG = {
    pass_threshold: 90, maybe_threshold: 70, max_selections: 5,
    weight_gpa: 1.0, weight_sat: 1.0, weight_act: 1.0,
    weight_lang: 1.0, weight_classrank: 1.0, weight_keywords: 1.0,
    cap_gpa: 0, cap_sat: 0, cap_lang: 0, cap_classrank: 0, cap_keywords: 0,
  }

  // 重み係数を適用し、上限でクランプする
  function applyWeightCap(pts, weightKey, capKey) {
    const w = parseFloat(DIAGNOSIS_CONFIG['weight_' + weightKey] || 1.0)
    const c = parseInt(DIAGNOSIS_CONFIG['cap_' + capKey] || 0)
    const weighted = Math.round(pts * w)
    return c > 0 ? Math.min(weighted, c) : weighted
  }

  function buildScoringFromAPI(rows) {
    const scoring = {}
    rows.forEach(r => {
      if (!scoring[r.item_type]) scoring[r.item_type] = r.key_val !== null ? {} : []
      if (r.key_val !== null) {
        scoring[r.item_type][r.key_val] = r.pts
      } else {
        scoring[r.item_type].push({ min: parseFloat(r.min_val), max: parseFloat(r.max_val), pts: r.pts })
      }
    })
    return scoring
  }

  function rangeScore(table, value) {
    if (!Array.isArray(table)) return 0
    for (const row of table) {
      if (value >= row.min && value <= row.max) return row.pts
    }
    return 0
  }

  function calcScore() {
    const bd = {}

    // GPA
    const gpa = parseFloat(document.getElementById('in_gpa').value)
    const gpaRaw = isNaN(gpa) ? 0 : rangeScore(SCORING.gpa, gpa)
    bd.gpa = applyWeightCap(gpaRaw, 'gpa', 'gpa')

    // SAT / ACT（高い方を採用し、それぞれの重みを適用してから比較）
    const sat = parseInt(document.getElementById('in_sat').value)
    const act = parseInt(document.getElementById('in_act').value)
    const satRaw = isNaN(sat) ? 0 : rangeScore(SCORING.sat, sat)
    const actRaw = isNaN(act) ? 0 : rangeScore(SCORING.act, act)
    const satWeighted = applyWeightCap(satRaw, 'sat', 'sat')
    const actWeighted = applyWeightCap(actRaw, 'act', 'sat')   // cap_sat を共用
    if (satWeighted >= actWeighted) {
      bd.test = satWeighted
      bd.testLabel = isNaN(sat) ? 'SAT/ACT なし' : 'SAT ' + sat
    } else {
      bd.test = actWeighted
      bd.testLabel = 'ACT ' + act
    }

    // 英語資格
    const langType = document.querySelector('input[name="langType"]:checked')?.value || 'none'
    const langVal  = parseFloat(document.getElementById('in_lang').value)
    bd.lang = 0
    bd.langLabel = '英語資格なし'
    if (langType !== 'none' && !isNaN(langVal)) {
      const langRaw = rangeScore(SCORING[langType], langVal)
      bd.lang = applyWeightCap(langRaw, 'lang', 'lang')
      bd.langLabel = langType.toUpperCase() + ' ' + langVal
    }

    // クラスランク
    const cr = document.getElementById('in_classrank').value
    const crRaw = cr ? (SCORING.classrank?.[cr] || 0) : 0
    bd.classrank = applyWeightCap(crRaw, 'classrank', 'classrank')

    // キーワード・課外活動
    let actRawTotal = 0
    bd.actLabels = []
    ;[1, 2, 3].forEach(n => {
      const val = (document.getElementById('act' + n)?.value || '').trim().toLowerCase()
      if (!val) return
      KW_DATA.forEach(kw => {
        if (val.includes(kw.keyword.toLowerCase())) {
          actRawTotal += kw.points
          bd.actLabels.push(kw.keyword + ' +' + kw.points)
        }
      })
    })
    bd.activity = applyWeightCap(actRawTotal, 'keywords', 'keywords')

    bd.total = bd.gpa + bd.test + bd.lang + bd.classrank + bd.activity
    return bd
  }

  function renderUnivSelector() {
    const q = (document.getElementById('univSearchUser')?.value || '').toLowerCase()
    const grid = document.getElementById('univGrid')
    if (!grid) return
    grid.innerHTML = ''
    const filtered = UNIV_DATA.filter(u => !q || u.name.toLowerCase().includes(q))
    filtered.forEach(u => {
      const isSelected = selectedUnivIds.includes(u.id)
      const isDisabled = !isSelected && selectedUnivIds.length >= DIAGNOSIS_CONFIG.max_selections
      const div = document.createElement('div')
      div.className = 'univ-card' + (isSelected ? ' selected' : '') + (isDisabled ? ' disabled' : '')
      div.innerHTML = `
        <div class="univ-name">${u.name}</div>
        ${u.needBased ? '<span class="univ-need">Need-based 対応</span>' : ''}
      `
      if (!isDisabled) {
        div.addEventListener('click', () => toggleUniv(u.id))
      }
      grid.appendChild(div)
    })
    const selCount = document.getElementById('selCount')
    const btnDiagnose = document.getElementById('btnDiagnose')
    if (selCount) selCount.textContent = selectedUnivIds.length
    if (btnDiagnose) btnDiagnose.disabled = selectedUnivIds.length === 0
  }

  function toggleUniv(id) {
    const idx = selectedUnivIds.indexOf(id)
    if (idx >= 0) {
      selectedUnivIds.splice(idx, 1)
    } else {
      if (selectedUnivIds.length >= DIAGNOSIS_CONFIG.max_selections) return
      selectedUnivIds.push(id)
    }
    renderUnivSelector()
  }

  function runDiagnosis() {
    const bd = calcScore()
    currentStep = 3
    document.getElementById('step2').style.display = 'none'
    document.getElementById('step3').style.display = 'block'
    renderStepIndicator()

    const list = document.getElementById('resultList')
    list.innerHTML = ''
    const needWanted = document.querySelector('input[name="needBased"]:checked')?.value === 'yes'
    const diagResults = []

    selectedUnivIds.forEach(uid => {
      const u = UNIV_DATA.find(x => x.id === uid)
      if (!u) return
      const needMismatch = needWanted && !u.needBased
      const ratio = Math.min(1, bd.total / u.score)
      const pct   = Math.round(ratio * 100)
      let cls, badgeClass, badgeText, verdict
      const passT  = DIAGNOSIS_CONFIG.pass_threshold  / 100
      const maybeT = DIAGNOSIS_CONFIG.maybe_threshold / 100
      if (ratio >= passT)      { cls = 'pass';  badgeClass = 'badge-pass';  badgeText = '合格見込み ✓'; verdict = '合格見込み' }
      else if (ratio >= maybeT){ cls = 'maybe'; badgeClass = 'badge-maybe'; badgeText = '要検討 △';    verdict = '要検討' }
      else                     { cls = 'hard';  badgeClass = 'badge-hard';  badgeText = '難しい ✗';    verdict = '難しい' }

      diagResults.push({ name: u.name, verdict, pct })

      const div = document.createElement('div')
      div.className = 'result-card ' + cls
      div.innerHTML = `
        <div class="result-header">
          <div>
            <div class="result-name">${u.name}</div>
            ${needMismatch ? '<div style="font-size:0.72rem;color:#f59e0b;margin-top:3px;">⚠ この大学はNeed-based非対応</div>' : ''}
          </div>
          <span class="result-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="result-bar-wrap">
          <div class="result-bar-bg"><div class="result-bar-fill fill-${cls}" style="width:0%" id="bar_${uid}"></div></div>
          <span style="font-size:0.82rem;font-weight:600;min-width:52px;text-align:right;">${pct}%</span>
        </div>
        <div class="result-scores">
          ${bd.actLabels.length ? '<span>課外活動加点: ' + bd.actLabels.join('、') + '</span>' : ''}
        </div>
      `
      list.appendChild(div)
      setTimeout(() => {
        const bar = document.getElementById('bar_' + uid)
        if (bar) bar.style.width = pct + '%'
      }, 100)
    })

    // Discord通知
    const langType = document.querySelector('input[name="langType"]:checked')?.value || 'none'
    const langVal  = document.getElementById('in_lang').value
    fetch('/api/diagnosis/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step1: {
          gpa:       document.getElementById('in_gpa').value,
          classrank: document.getElementById('in_classrank').value,
          sat:       document.getElementById('in_sat').value,
          act:       document.getElementById('in_act').value,
          lang:      langType !== 'none' ? `${langType.toUpperCase()} ${langVal}` : 'なし',
          needBased: document.querySelector('input[name="needBased"]:checked')?.value,
          act1:      document.getElementById('act1').value,
          act2:      document.getElementById('act2').value,
          act3:      document.getElementById('act3').value,
        },
        results: diagResults,
      })
    })
    .then(r => r.json())

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // グローバルに関数を公開
  window.goToStep1 = goToStep1
  window.goToStep2 = goToStep2
  window.resetAll = resetAll
  window.updateLangInput = updateLangInput
  window.runDiagnosis = runDiagnosis
  window.renderUnivSelector = renderUnivSelector

  loadData()
}