// =====================
// tests/unit/diagnosis-calc.test.js
// 大学合格診断スコア計算ロジックのユニットテスト
//
// public/scripts/pages/diagnosis.js のブラウザコードは
// HTMLページ上でのみ動くため、計算ロジックをここで再現して検証する。
// =====================

// ─── diagnosis.js から抽出した純粋関数 ────────────────────────

/** テーブル形式のスコアリングで範囲に対応するptsを返す */
function rangeScore(table, value) {
  if (!Array.isArray(table)) return 0
  for (const row of table) {
    if (value >= row.min && value <= row.max) return row.pts
  }
  return 0
}

/** 重み係数を掛け、上限でクランプする（cap=0は無制限） */
function applyWeightCap(pts, config, weightKey, capKey) {
  const w = parseFloat(config['weight_' + weightKey] || 1.0)
  const c = parseInt(config['cap_'    + capKey]    || 0)
  const weighted = Math.round(pts * w)
  return c > 0 ? Math.min(weighted, c) : weighted
}

// ─────────────────────────────────────────────────────────────
// テスト用スコアリングテーブル（本番と同等の構造）
// ─────────────────────────────────────────────────────────────
const GPA_TABLE = [
  { min: 3.7, max: 4.0,  pts: 40 },
  { min: 3.3, max: 3.69, pts: 30 },
  { min: 3.0, max: 3.29, pts: 20 },
  { min: 2.0, max: 2.99, pts: 5  },
  { min: 0,   max: 1.99, pts: 0  },
]

const SAT_TABLE = [
  { min: 1500, max: 1600, pts: 40 },
  { min: 1400, max: 1499, pts: 30 },
  { min: 1300, max: 1399, pts: 20 },
  { min: 1200, max: 1299, pts: 10 },
  { min: 0,    max: 1199, pts: 0  },
]

const TOEFL_TABLE = [
  { min: 100, max: 120, pts: 20 },
  { min: 90,  max: 99,  pts: 15 },
  { min: 80,  max: 89,  pts: 10 },
  { min: 0,   max: 79,  pts: 0  },
]

// ─────────────────────────────────────────────────────────────
// rangeScore テスト
// ─────────────────────────────────────────────────────────────
describe('rangeScore()', () => {
  test('スコアが範囲内 → 対応するptsを返す', () => {
    expect(rangeScore(GPA_TABLE, 3.8)).toBe(40)
    expect(rangeScore(GPA_TABLE, 3.5)).toBe(30)
    expect(rangeScore(GPA_TABLE, 3.0)).toBe(20)
    expect(rangeScore(GPA_TABLE, 2.5)).toBe(5)
  })

  test('上限境界値ちょうど → 上位区間のptsを返す', () => {
    expect(rangeScore(GPA_TABLE, 4.0)).toBe(40)
    expect(rangeScore(GPA_TABLE, 3.69)).toBe(30)
  })

  test('下限境界値ちょうど → その区間のptsを返す', () => {
    expect(rangeScore(GPA_TABLE, 3.7)).toBe(40)
    expect(rangeScore(GPA_TABLE, 3.3)).toBe(30)
    expect(rangeScore(GPA_TABLE, 3.0)).toBe(20)
  })

  test('テーブルの範囲外（上限超え）→ 0を返す', () => {
    expect(rangeScore(GPA_TABLE, 4.1)).toBe(0)
    expect(rangeScore(SAT_TABLE, 1601)).toBe(0)
  })

  test('テーブルが配列でない → 0を返す', () => {
    expect(rangeScore({},        3.8)).toBe(0)
    expect(rangeScore(null,      3.8)).toBe(0)
    expect(rangeScore(undefined, 3.8)).toBe(0)
    expect(rangeScore('string',  3.8)).toBe(0)
  })

  test('空テーブル → 0を返す', () => {
    expect(rangeScore([], 3.8)).toBe(0)
  })

  test('SATテーブルでの検証', () => {
    expect(rangeScore(SAT_TABLE, 1550)).toBe(40)
    expect(rangeScore(SAT_TABLE, 1450)).toBe(30)
    expect(rangeScore(SAT_TABLE, 1000)).toBe(0)
  })

  test('TOEFLテーブルでの検証', () => {
    expect(rangeScore(TOEFL_TABLE, 110)).toBe(20)
    expect(rangeScore(TOEFL_TABLE, 95)).toBe(15)
    expect(rangeScore(TOEFL_TABLE, 70)).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// applyWeightCap テスト
// ─────────────────────────────────────────────────────────────
describe('applyWeightCap()', () => {
  test('weight=1.0, cap=0（デフォルト）→ ptsをそのまま返す', () => {
    const cfg = { weight_gpa: 1.0, cap_gpa: 0 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(40)
  })

  test('weight=2.0 → ptsが2倍になる', () => {
    const cfg = { weight_gpa: 2.0, cap_gpa: 0 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(80)
  })

  test('weight=0.5 → ptsが半分になる', () => {
    const cfg = { weight_gpa: 0.5, cap_gpa: 0 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(20)
  })

  test('weight=1.5, 小数点の丸め → 正しく四捨五入', () => {
    const cfg = { weight_gpa: 1.5, cap_gpa: 0 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(60) // 40 * 1.5 = 60
    expect(applyWeightCap(30, cfg, 'gpa', 'gpa')).toBe(45) // 30 * 1.5 = 45
  })

  test('cap > 0 かつ weighted > cap → capの値に制限', () => {
    const cfg = { weight_gpa: 1.0, cap_gpa: 30 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(30)
  })

  test('cap > 0 かつ weighted <= cap → ptsをそのまま返す', () => {
    const cfg = { weight_gpa: 1.0, cap_gpa: 50 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(40)
  })

  test('weight と cap を同時に適用 → 重み後にcapで制限', () => {
    const cfg = { weight_gpa: 2.0, cap_gpa: 50 }
    // 40 * 2.0 = 80 → cap=50 → 50
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(50)
  })

  test('configにキーがない → デフォルト(weight=1.0, cap=0)として動作', () => {
    expect(applyWeightCap(40, {}, 'gpa', 'gpa')).toBe(40)
  })

  test('pts=0 のとき → 何があっても 0 を返す', () => {
    const cfg = { weight_gpa: 2.0, cap_gpa: 0 }
    expect(applyWeightCap(0, cfg, 'gpa', 'gpa')).toBe(0)
  })

  test('cap=0 は「無制限」として扱われる（制限しない）', () => {
    const cfg = { weight_gpa: 3.0, cap_gpa: 0 }
    expect(applyWeightCap(40, cfg, 'gpa', 'gpa')).toBe(120) // 上限なし
  })

  test('各カテゴリキーが正しく参照される（sat, lang, classrank, keywords）', () => {
    const cfg = {
      weight_sat: 1.2, cap_sat: 0,
      weight_lang: 0.8, cap_lang: 15,
      weight_classrank: 1.5, cap_classrank: 0,
      weight_keywords: 2.0, cap_keywords: 20,
    }
    expect(applyWeightCap(30, cfg, 'sat',       'sat')).toBe(36)  // 30*1.2
    expect(applyWeightCap(20, cfg, 'lang',      'lang')).toBe(15) // 20*0.8=16 → cap=15
    expect(applyWeightCap(10, cfg, 'classrank', 'classrank')).toBe(15) // 10*1.5
    expect(applyWeightCap(15, cfg, 'keywords',  'keywords')).toBe(20)  // 15*2=30 → cap=20
  })
})

// ─────────────────────────────────────────────────────────────
// 合計スコア計算シナリオ（統合テスト的検証）
// ─────────────────────────────────────────────────────────────
describe('スコア計算 統合シナリオ', () => {
  const defaultCfg = {
    weight_gpa: 1.0, weight_sat: 1.0, weight_act: 1.0,
    weight_lang: 1.0, weight_classrank: 1.0, weight_keywords: 1.0,
    cap_gpa: 0, cap_sat: 0, cap_lang: 0, cap_classrank: 0, cap_keywords: 0,
  }

  test('全weight=1.0のとき、スコアが正しく積算される', () => {
    const gpa       = applyWeightCap(rangeScore(GPA_TABLE,   3.8),  defaultCfg, 'gpa',       'gpa')
    const sat       = applyWeightCap(rangeScore(SAT_TABLE,   1500), defaultCfg, 'sat',       'sat')
    const lang      = applyWeightCap(rangeScore(TOEFL_TABLE, 105),  defaultCfg, 'lang',      'lang')
    const classrank = applyWeightCap(10,                             defaultCfg, 'classrank', 'classrank')
    const activity  = applyWeightCap(15,                             defaultCfg, 'keywords',  'keywords')
    // gpa=40, sat=40, lang=20, classrank=10, activity=15 → 合計125
    expect(gpa + sat + lang + classrank + activity).toBe(125)
  })

  test('高い重みを設定すると合計スコアが増加する', () => {
    const boostCfg = { ...defaultCfg, weight_gpa: 2.0 }
    const gpa = applyWeightCap(rangeScore(GPA_TABLE, 3.8), boostCfg, 'gpa', 'gpa')
    expect(gpa).toBe(80) // 40 * 2.0
  })

  test('capを設定すると上限以上にならない', () => {
    const capCfg = { ...defaultCfg, cap_gpa: 25 }
    const gpa = applyWeightCap(rangeScore(GPA_TABLE, 3.8), capCfg, 'gpa', 'gpa')
    expect(gpa).toBe(25) // 40 → cap=25
  })

  test('大学スコア比（合格率計算）の検証', () => {
    const totalScore = 100
    const univScore  = 120
    const ratio = Math.min(1, totalScore / univScore)
    const pct   = Math.round(ratio * 100)
    expect(pct).toBe(83)
  })

  test('合格閾値90%判定: ratio >= 0.90 → 合格見込み', () => {
    const passThreshold  = 90 / 100
    const maybeThreshold = 70 / 100
    const ratio90 = 0.92
    const ratio75 = 0.75
    const ratio50 = 0.50

    expect(ratio90 >= passThreshold).toBe(true)
    expect(ratio75 >= maybeThreshold && ratio75 < passThreshold).toBe(true)
    expect(ratio50 < maybeThreshold).toBe(true)
  })
})
