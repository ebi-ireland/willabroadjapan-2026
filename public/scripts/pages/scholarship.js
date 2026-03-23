// =====================
// scholarship.js
// パス: /public/scripts/pages/scholarship.js
// 使用: /public/student-japan/scholarship.html
// 用途: 大学奨学金（地図）ページ
// =====================

const path = window.location.pathname

if (path === '/student-japan/scholarship.html') {

  let allColleges = []
  let mapInstance = null
  let favList = JSON.parse(localStorage.getItem('fav_universities') || '[]')
  let favIds = new Set(favList.map(u => u.id))
  let currentUser = null

  async function loadCurrentUser() {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      currentUser = await res.json()
      const dbRes = await fetch(`/api/scholarships/university/favorites/${currentUser.id}`)
      if (!dbRes.ok) return
      const dbFavs = await dbRes.json()
      favList = dbFavs
      favIds = new Set(dbFavs.map(u => u.id))
      localStorage.setItem('fav_universities', JSON.stringify(favList))
    } catch (_) {}
  }

  // =====================
  // Mapbox
  // =====================
  async function initMap() {
    try {
      const tokenRes = await fetch('/api/mapbox-token')
      const tokenData = await tokenRes.json()
      const token = tokenData.token
      if (!token) { console.error('Mapboxトークンが取得できませんでした'); return }

      const collegesRes = await fetch('/api/scholarships/university')
      allColleges = await collegesRes.json()

      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: 'map',
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [{
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 22
          }]
        },
        center: [135, 40],
        zoom: 4,
        projection: 'globe',
        antialias: true,
        dragPan: {
          inertia: true,
          inertiaDeceleration: 500,
          inertiaLinearity: 0.03,
          maxSpeed: 60,
        },
        scrollZoom: { speed: 0.05 },
        doubleClickZoom: false,
        keyboard: false
      })

      mapInstance = map
      map.addControl(new mapboxgl.NavigationControl())
      map.on('load', () => window.updateMarkers(allColleges, map))
      window.allColleges = allColleges

    } catch (err) {
      console.error('地図の初期化エラー:', err)
    }
  }

  // =====================
  // マーカー
  // =====================
  window.updateMarkers = function(colleges, map) {
    const m = map || mapInstance
    if (!m) return
    if (window._markers) window._markers.forEach(marker => marker.remove())
    window._markers = []

    colleges.forEach(c => {
      if (c.lat == null || c.lng == null) return

      const el = document.createElement('div')
      el.style.cssText = 'width:14px;height:14px;background:#ff8040;border:2px solid #fff;border-radius:50%;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.4);'

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14
      }).setHTML(`<div style="font-size:12px;font-weight:700;color:#111;padding:2px 4px;">${c.name}</div>`)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(m)

      el.addEventListener('mouseenter', () => { if (!marker.getPopup().isOpen()) marker.togglePopup() })
      el.addEventListener('mouseleave', () => { if (marker.getPopup().isOpen()) marker.togglePopup() })
      el.addEventListener('click', e => {
        e.stopPropagation()
        if (marker.getPopup().isOpen()) marker.togglePopup()
        openPanel(c, m)
        fetch(`/api/scholarships/university/${c.id}/view`, { method: 'POST' }).catch(() => {})
      })

      window._markers.push(marker)
    })
  }

  // =====================
  // 詳細パネル
  // =====================
  function openPanel(c, map) {
    document.getElementById('panel-name').innerHTML = c.url
      ? `<a href="${c.url}" target="_blank" class="panel-name-link">${c.name} ↗</a>`
      : `<span class="panel-name-text">${c.name}</span>`

    function row(label, val) {
      if (val == null || val === '' || val === false) return ''
      return `<div class="detail-row"><span>${label}</span>${val}</div>`
    }

    const tuitionStr = c.tuition != null ? `${c.tuition_currency || 'USD'} ${Number(c.tuition).toLocaleString()}` : null
    const livingStr  = c.living  != null ? `${c.living_currency  || 'USD'} ${Number(c.living).toLocaleString()}` : null
    const totalStr   = (c.tuition && c.living) ? `${c.tuition_currency || 'USD'} ${(Number(c.tuition) + Number(c.living)).toLocaleString()}` : null
    const toeflSub = [c.toefl_reading, c.toefl_listening, c.toefl_speaking, c.toefl_writing]
    const ieltsSub = [c.ielts_reading, c.ielts_listening, c.ielts_speaking, c.ielts_writing]

    document.getElementById('panel-body').innerHTML =
      row('種類',         c.type) +
      row('国',           c.country) +
      row('都市',         c.city) +
      row('気候',         c.climate) +
      row('学生数',       c.students   != null ? `${Number(c.students).toLocaleString()} 人` : null) +
      row('留学生割合',   c.intl_ratio != null ? `${c.intl_ratio}%` : null) +
      row('全体合格率',   c.acceptance_total  != null ? `${c.acceptance_total}%`  : null) +
      row('男性合格率',   c.acceptance_man    != null ? `${c.acceptance_man}%`    : null) +
      row('女性合格率',   c.acceptance_woman  != null ? `${c.acceptance_woman}%`  : null) +
      row('留学生合格率', c.acceptance_intl   != null ? `${c.acceptance_intl}%`   : null) +
      row('ED合格率',     c.acceptance_ed     != null ? `${c.acceptance_ed}%`     : null) +
      row('EA合格率',     c.acceptance_ea     != null ? `${c.acceptance_ea}%`     : null) +
      row('RD合格率',     c.acceptance_rd     != null ? `${c.acceptance_rd}%`     : null) +
      row('目安GPA',      c.gpa) +
      row('SAT総合',      c.application_sat_total) +
      row('SAT R&W',      c.application_sat_rw) +
      row('SAT Math',     c.application_sat_math) +
      row('ACT総合',      c.application_act_total) +
      row('ACT English',  c.application_act_english) +
      row('ACT Math',     c.application_act_math) +
      row('ACT Science',  c.application_act_science) +
      row('授業料',       tuitionStr) +
      row('生活費',       livingStr) +
      row('合計',         totalStr) +
      row('平均奨学金額', c.average_amount_scholarship != null ? `${c.tuition_currency || 'USD'} ${Number(c.average_amount_scholarship).toLocaleString()}` : null) +
      row('Need-based',   c.need_based ? '対応' : null) +
      row('Need Met',     c.need_met   != null ? `${c.need_met}%` : null) +
      row('TOEFL',        c.toefl_total) +
      row('TOEFL R/L/S/W', toeflSub.some(v => v != null) ? toeflSub.map(v => v ?? '-').join(' / ') : null) +
      row('IELTS',        c.ielts_total) +
      row('IELTS R/L/S/W', ieltsSub.some(v => v != null) ? ieltsSub.map(v => v ?? '-').join(' / ') : null) +
      row('Duolingo',     c.duolingo_total) +
      row('語学条件',     c.language_requirements) +
      row('強い学問',     c.majors) +
      row('財団',         c.foundation) +
      row('大学群',       c.elite_group)

    const isFav = favIds.has(c.id)
    const favBtn = document.createElement('button')
    favBtn.style.cssText = `margin-top:16px;width:100%;padding:12px;border:1px solid rgba(255,128,64,0.4);border-radius:10px;background:${isFav ? 'rgba(255,128,64,0.2)' : 'rgba(255,128,64,0.08)'};color:#ff8040;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.2s ease;`
    favBtn.textContent = isFav ? '★ お気に入り済み' : '☆ お気に入りに追加'
    favBtn.addEventListener('click', () => toggleFav(c, favBtn))
    document.getElementById('panel-body').appendChild(favBtn)

    document.getElementById('detail-panel').classList.add('open')
    setTimeout(() => { if (map || mapInstance) (map || mapInstance).resize() }, 350)
  }

  window.closePanel = function() {
    document.getElementById('detail-panel').classList.remove('open')
    setTimeout(() => { if (mapInstance) mapInstance.resize() }, 350)
  }

  // =====================
  // 地域ジャンプ
  // =====================
  window.flyToRegion = function(region) {
    if (!mapInstance) return
    const regions = {
      japan:   { center: [138, 37], zoom: 5 },
      uk:      { center: [-2, 54],  zoom: 5 },
      america: { center: [-98, 38], zoom: 4 },
    }
    const target = regions[region]
    if (!target) return
    mapInstance.flyTo({ center: target.center, zoom: target.zoom, speed: 1.5, curve: 1.5 })
  }

  // =====================
  // お気に入り管理
  // =====================
  function toggleFav(college, btn) {
    if (favIds.has(college.id)) {
      favList = favList.filter(u => u.id !== college.id)
      favIds.delete(college.id)
      btn.textContent = '☆ お気に入りに追加'
      btn.style.background = 'rgba(255,128,64,0.08)'
      if (currentUser) {
        fetch(`/api/scholarships/university/${college.id}/favorite`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id })
        }).catch(() => {})
      }
    } else {
      if (favList.length >= 30) { alert('お気に入りは最大30校までです'); return }
      favList.push(college)
      favIds.add(college.id)
      btn.textContent = '★ お気に入り済み'
      btn.style.background = 'rgba(255,128,64,0.2)'
      if (currentUser) {
        fetch(`/api/scholarships/university/${college.id}/favorite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUser.id })
        }).catch(() => {})
      }
    }
    localStorage.setItem('fav_universities', JSON.stringify(favList))
  }

  // =====================
  // フィルター
  // =====================
  window.toggleFilter = function() {
    document.getElementById('filterSidebar').classList.toggle('open')
  }

  document.addEventListener('click', e => {
    const sidebar = document.getElementById('filterSidebar')
    const btn = document.getElementById('filterToggleBtn')
    if (!sidebar?.classList.contains('open')) return
    if (!sidebar.contains(e.target) && !btn?.contains(e.target)) sidebar.classList.remove('open')
  })

  window.toggleCountryDropdown = function() {
    document.getElementById('countryTrigger').classList.toggle('open')
    document.getElementById('countryDropdown').classList.toggle('open')
  }

  window.updateCountryLabel = function() {
    const checked = document.querySelectorAll('#countryDropdown input:checked')
    document.getElementById('countryTriggerLabel').textContent = checked.length === 0 ? '選択する' : Array.from(checked).map(el => el.value).join('、')
  }

  window.updateRange = function(inputId, valId, factor) {
    const el = document.getElementById(inputId)
    const valEl = document.getElementById(valId)
    if (!el || !valEl) return
    if (factor === 0.1) valEl.textContent = (el.value / 10).toFixed(1)
    else if (factor === '%') valEl.textContent = el.value + '%'
    else valEl.textContent = el.value
  }

  window.updateBudget = function() {
    const el = document.getElementById('filterBudget')
    const valEl = document.getElementById('filterBudgetVal')
    if (!el || !valEl) return
    valEl.textContent = (parseInt(el.value) >= 800 ? '800+' : el.value) + ' 万円'
  }

  window.updateStudents = function() {
    const el = document.getElementById('filterStudents')
    const valEl = document.getElementById('filterStudentsVal')
    if (!el || !valEl) return
    const v = parseInt(el.value)
    valEl.textContent = (v >= 20000 ? '20,000+' : v.toLocaleString()) + ' 人'
  }

  window.updateGpa = function() {
    const el = document.getElementById('filterGpa')
    const valEl = document.getElementById('filterGpaVal')
    if (!el || !valEl) return
    valEl.textContent = (el.value / 10).toFixed(1)
  }

  window.clearAllFilters = function() {
    document.querySelectorAll('.filter-sidebar input[type=checkbox]').forEach(el => el.checked = false)
    document.querySelectorAll('.filter-sidebar input[type=range]').forEach(el => {
      el.value = el.max
      el.dispatchEvent(new Event('input'))
    })
    const kw = document.getElementById('filterKeyword')
    if (kw) kw.value = ''
    applyFilters()
  }

  window.applyFilters = function() {
    const keyword  = (document.getElementById('filterKeyword')?.value || '').toLowerCase()
    const toefl    = parseInt(document.getElementById('filterToefl')?.value || 0)
    const ielts    = parseFloat(document.getElementById('filterIelts')?.value || 0) / 10
    const duolingo = parseInt(document.getElementById('filterDuolingo')?.value || 0)
    const budget   = parseInt(document.getElementById('filterBudget')?.value || 800)
    const students = parseInt(document.getElementById('filterStudents')?.value || 20000)
    const intl     = parseInt(document.getElementById('filterIntl')?.value || 100)
    const gpa      = parseFloat(document.getElementById('filterGpa')?.value || 50) / 10
    const checkedCountries = Array.from(document.querySelectorAll('#countryDropdown input:checked')).map(el => el.value)
    const checkedBoxes     = Array.from(document.querySelectorAll('.filter-checks input[type=checkbox]:checked')).map(el => el.value)

    const filtered = allColleges.filter(c => {
      if (keyword && !c.name.toLowerCase().includes(keyword)) return false
      if (checkedCountries.length > 0 && !checkedCountries.includes(c.country)) return false
      if (toefl    > 0 && c.toefl_total   != null && c.toefl_total   > toefl)    return false
      if (ielts    > 0 && c.ielts_total    != null && c.ielts_total   > ielts)    return false
      if (duolingo > 0 && c.duolingo_total != null && c.duolingo_total > duolingo) return false
      if (budget < 800) {
        const totalJPY = ((c.tuition || 0) + (c.living || 0)) * 150 / 10000
        if (totalJPY > budget) return false
      }
      if (students < 20000 && c.students != null && c.students > students) return false
      if (intl < 100 && c.intl_ratio != null && c.intl_ratio > intl) return false
      if (gpa < 5.0 && c.gpa != null && c.gpa > gpa) return false
      if (checkedBoxes.includes('need_based')     && !c.need_based)                            return false
      if (checkedBoxes.includes('need_met_100')   && (c.need_met == null || c.need_met < 100)) return false
      if (checkedBoxes.includes('full_tuition')   && !c.full_tuition)                          return false
      if (checkedBoxes.includes('tuition_waiver') && !c.tuition_waiver)                        return false
      if (checkedBoxes.includes('elite_group')    && !c.elite_group)                           return false
      if (checkedBoxes.includes('few_japanese')   && !c.few_japanese)                          return false
      if (checkedBoxes.includes('ug_only')        && !c.ug_only)                               return false
      if (checkedBoxes.includes('few_grad')       && !c.few_grad)                              return false
      if (checkedBoxes.includes('many_grad')      && !c.many_grad)                             return false
      if (checkedBoxes.includes('phd')            && !c.has_phd)                               return false
      if (checkedBoxes.includes('research')       && !c.is_research)                           return false
      if (checkedBoxes.includes('direct_flight')  && !c.direct_flight)                         return false
      if (checkedBoxes.includes('transit_90')     && !c.transit_90)                            return false
      if (checkedBoxes.includes('city_2h')        && !c.city_2h)                               return false
      if (checkedBoxes.includes('shuttle')        && !c.shuttle)                               return false
      if (checkedBoxes.includes('rideshare')      && !c.rideshare)                             return false
      if (checkedBoxes.includes('library_24h')    && !c.library_24h)                           return false
      if (checkedBoxes.includes('supermarket')    && !c.supermarket)                           return false
      if (checkedBoxes.includes('yanai')          && !(c.foundation && c.foundation.includes('柳井')))          return false
      if (checkedBoxes.includes('sasagawa')       && !(c.foundation && c.foundation.includes('笹川')))          return false
      if (checkedBoxes.includes('grupe')          && !(c.foundation && c.foundation.includes('グルー')))        return false
      if (checkedBoxes.includes('toshin')         && !(c.foundation && c.foundation.includes('東進')))          return false
      if (checkedBoxes.includes('ezoe')           && !(c.foundation && c.foundation.includes('江副')))          return false
      if (checkedBoxes.includes('yawh')           && !(c.foundation && c.foundation.includes('YouAreWelcome'))) return false
      if (checkedBoxes.includes('stamps')         && !(c.foundation && c.foundation.includes('Stamps')))        return false
      if (checkedBoxes.includes('laidlaw')        && !(c.foundation && c.foundation.includes('Laidlaw')))       return false
      if (checkedBoxes.includes('any_foundation') && !c.foundation)                                             return false
      const climateMap = { oceanic: '西岸海洋性', mediterranean: '地中海', humid_sub: '温暖温潤', subarctic: '亜寒帯', steppe: 'ステップ', tropical: '熱帯' }
      const climateFilters = checkedBoxes.filter(v => climateMap[v])
      if (climateFilters.length > 0 && !climateFilters.some(v => c.climate && c.climate.includes(climateMap[v]))) return false
      const majorMap = { startup: '起業', finance: '金融', mgmt: '経営', hospitality: 'ホスピタリティ', economics: '経済', ai: 'AI', engineering: 'エンジニア', bio: 'バイオ', env: '環境', agri: '農業', design: 'デザイン', media: 'メディア', arch: '建築', game: 'ゲーム', psych: '心理', ir: '国際関係', edu: '教育', law: '法学', social: '社会福祉', nursing: '看護', sports: 'スポーツ', pharma: '薬学', neuro: '脳科学', liberal_arts: 'リベラルアーツ', interdisciplinary: '学際' }
      const majorFilters = checkedBoxes.filter(v => majorMap[v])
      if (majorFilters.length > 0 && !majorFilters.some(v => c.majors && c.majors.includes(majorMap[v]))) return false
      const schMonths = checkedBoxes.filter(v => v.startsWith('month_')).map(v => parseInt(v.replace('month_', '')))
      if (schMonths.length > 0 && !schMonths.includes(c.scholarship_deadline)) return false
      const appMonths = checkedBoxes.filter(v => v.startsWith('app_') && v !== 'app_rolling').map(v => parseInt(v.replace('app_', '')))
      if (appMonths.length > 0 && !appMonths.includes(c.application_deadline)) return false
      return true
    })
    window.updateMarkers(filtered)
  }

  loadCurrentUser().then(() => initMap())
}