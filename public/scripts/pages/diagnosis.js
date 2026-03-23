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
    const [colleges, keywords] = await Promise.all([
      fetch('/api/diagnosis/colleges').then(r => r.json()),
      fetch('/api/diagnosis/keywords').then(r => r.json()),
    ])
    UNIV_DATA = colleges.map(u => ({
      id: u.id,
      name: u.name,
      score: u.score,
      needBased: !!u.need_based,
    }))
    KW_DATA = keywords
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

  const SCORING = {
    gpa: [
      { min:4.0,  max:4.0,  pts:5000 },
      { min:3.9,  max:3.99, pts:4600 },
      { min:3.8,  max:3.89, pts:4200 },
      { min:3.7,  max:3.79, pts:3800 },
      { min:3.6,  max:3.69, pts:3400 },
      { min:3.5,  max:3.59, pts:3000 },
      { min:3.4,  max:3.49, pts:2600 },
      { min:3.3,  max:3.39, pts:2200 },
      { min:3.0,  max:3.29, pts:1800 },
      { min:0,    max:2.99, pts:1000 },
    ],
    sat: [
      { min:1550, max:1600, pts:5000 },
      { min:1500, max:1549, pts:4500 },
      { min:1450, max:1499, pts:4000 },
      { min:1400, max:1449, pts:3500 },
      { min:1350, max:1399, pts:3000 },
      { min:1300, max:1349, pts:2500 },
      { min:1200, max:1299, pts:2000 },
      { min:1100, max:1199, pts:1400 },
      { min:0,    max:1099, pts:800  },
    ],
    act: [
      { min:35, max:36, pts:5000 },
      { min:33, max:34, pts:4500 },
      { min:31, max:32, pts:4000 },
      { min:29, max:30, pts:3500 },
      { min:27, max:28, pts:3000 },
      { min:25, max:26, pts:2500 },
      { min:23, max:24, pts:2000 },
      { min:20, max:22, pts:1400 },
      { min:0,  max:19, pts:800  },
    ],
    toefl: [
      { min:115, max:120, pts:4000 },
      { min:110, max:114, pts:3500 },
      { min:105, max:109, pts:3000 },
      { min:100, max:104, pts:2500 },
      { min:90,  max:99,  pts:2000 },
      { min:80,  max:89,  pts:1500 },
      { min:70,  max:79,  pts:1000 },
      { min:0,   max:69,  pts:500  },
    ],
    ielts: [
      { min:8.5, max:9.0, pts:4000 },
      { min:8.0, max:8.4, pts:3500 },
      { min:7.5, max:7.9, pts:3000 },
      { min:7.0, max:7.4, pts:2500 },
      { min:6.5, max:6.9, pts:2000 },
      { min:6.0, max:6.4, pts:1500 },
      { min:5.5, max:5.9, pts:1000 },
      { min:0,   max:5.4, pts:500  },
    ],
    duolingo: [
      { min:145, max:160, pts:4000 },
      { min:130, max:144, pts:3500 },
      { min:120, max:129, pts:3000 },
      { min:110, max:119, pts:2500 },
      { min:100, max:109, pts:2000 },
      { min:90,  max:99,  pts:1500 },
      { min:80,  max:89,  pts:1000 },
      { min:0,   max:79,  pts:500  },
    ],
    classrank: {
      cr_5: 2000, cr_10: 1700, cr_20: 1400,
      cr_30: 1100, cr_50: 700, cr_lo: 300, cr_na: 0,
    },
  }

  function rangeScore(table, value) {
    for (const row of table) {
      if (value >= row.min && value <= row.max) return row.pts
    }
    return 0
  }

  function calcScore() {
    const bd = {}
    const gpa = parseFloat(document.getElementById('in_gpa').value)
    bd.gpa = isNaN(gpa) ? 0 : rangeScore(SCORING.gpa, gpa)
    const sat = parseInt(document.getElementById('in_sat').value)
    const act = parseInt(document.getElementById('in_act').value)
    const satPts = isNaN(sat) ? 0 : rangeScore(SCORING.sat, sat)
    const actPts = isNaN(act) ? 0 : rangeScore(SCORING.act, act)
    bd.test = Math.max(satPts, actPts)
    bd.testLabel = satPts >= actPts ? (isNaN(sat) ? 'SAT/ACT なし' : 'SAT ' + sat) : 'ACT ' + act
    const langType = document.querySelector('input[name="langType"]:checked')?.value || 'none'
    const langVal  = parseFloat(document.getElementById('in_lang').value)
    bd.lang = 0
    bd.langLabel = '英語資格なし'
    if (langType !== 'none' && !isNaN(langVal)) {
      bd.lang = rangeScore(SCORING[langType], langVal)
      bd.langLabel = langType.toUpperCase() + ' ' + langVal
    }
    const cr = document.getElementById('in_classrank').value
    bd.classrank = cr ? (SCORING.classrank[cr] || 0) : 0
    bd.activity = 0
    bd.actLabels = []
    ;[1, 2, 3].forEach(n => {
      const val = (document.getElementById('act' + n)?.value || '').trim().toLowerCase()
      if (!val) return
      KW_DATA.forEach(kw => {
        if (val.includes(kw.keyword.toLowerCase())) {
          bd.activity += kw.points
          bd.actLabels.push(kw.keyword + ' +' + kw.points)
        }
      })
    })
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
      const isDisabled = !isSelected && selectedUnivIds.length >= 5
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
      if (selectedUnivIds.length >= 5) return
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
      if (ratio >= 0.9)      { cls = 'pass';  badgeClass = 'badge-pass';  badgeText = '合格見込み ✓'; verdict = '合格見込み' }
      else if (ratio >= 0.7) { cls = 'maybe'; badgeClass = 'badge-maybe'; badgeText = '要検討 △';    verdict = '要検討' }
      else                   { cls = 'hard';  badgeClass = 'badge-hard';  badgeText = '難しい ✗';    verdict = '難しい' }

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