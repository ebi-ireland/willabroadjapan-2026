// =====================
// tests/unit/backup.test.js
// services/backup.js のユニットテスト
// =====================

// ── モック宣言（jest.mock は巻き上げされるため最上部に置く）──
jest.mock('node-cron', () => ({ schedule: jest.fn() }))
jest.mock('fs')
jest.mock('child_process')

const fs          = require('fs')
const { exec }    = require('child_process')
// backup モジュールはモック適用後に一度だけロード
const { runBackup, listBackups } = require('../../services/backup')

beforeEach(() => {
  jest.clearAllMocks()

  // デフォルト fs 動作
  fs.existsSync.mockReturnValue(true)
  fs.mkdirSync.mockImplementation(() => {})
  fs.readdirSync.mockReturnValue([])
  fs.statSync.mockReturnValue({
    size: 1024,
    mtime: new Date('2026-01-01'),
    mtimeMs: new Date('2026-01-01').getTime(),
  })
  fs.unlinkSync.mockImplementation(() => {})

  // 環境変数を設定
  process.env.DB_HOST     = 'localhost'
  process.env.DB_USER     = 'root'
  process.env.DB_PASSWORD = 'password'
  process.env.DB_NAME     = 'mydb'
})

// ─────────────────────────────────────────────────────────────
// listBackups
// ─────────────────────────────────────────────────────────────
describe('listBackups()', () => {
  test('.sql ファイルのみ返す（.txt などは除外）', () => {
    fs.readdirSync.mockReturnValue([
      'backup_2026-01-03.sql',
      'backup_2026-01-01.sql',
      'notes.txt',
      'backup_2026-01-02.sql',
    ])
    fs.statSync.mockImplementation((fp) => {
      const m = fp.match(/(\d{4}-\d{2}-\d{2})/)
      const d = m ? new Date(m[1]) : new Date()
      return { size: 2048, mtime: d, mtimeMs: d.getTime() }
    })

    const result = listBackups()
    expect(result).toHaveLength(3) // .sql ファイルは3件、.txt 1件は除外
    result.forEach(r => expect(r.name).toMatch(/\.sql$/))
  })

  test('最新ファイルが先頭になるよう降順ソートされる', () => {
    fs.readdirSync.mockReturnValue([
      'backup_2026-01-01.sql',
      'backup_2026-01-03.sql',
      'backup_2026-01-02.sql',
    ])
    fs.statSync.mockImplementation((fp) => {
      const m = fp.match(/(\d{4}-\d{2}-\d{2})/)
      const d = new Date(m[1])
      return { size: 1024, mtime: d, mtimeMs: d.getTime() }
    })

    const result = listBackups()
    expect(result[0].name).toBe('backup_2026-01-03.sql')
    expect(result[2].name).toBe('backup_2026-01-01.sql')
  })

  test('返却オブジェクトに name / size / created_at が含まれる', () => {
    fs.readdirSync.mockReturnValue(['backup_2026-01-01.sql'])
    fs.statSync.mockReturnValue({
      size: 512000,
      mtime: new Date('2026-01-01'),
      mtimeMs: new Date('2026-01-01').getTime(),
    })

    const result = listBackups()
    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('size')
    expect(result[0]).toHaveProperty('created_at')
  })

  test('ディレクトリ読み取り失敗 → 空配列を返す（クラッシュしない）', () => {
    fs.readdirSync.mockImplementation(() => { throw new Error('ENOENT') })
    expect(listBackups()).toEqual([])
  })

  test('.sql ファイルがない → 空配列を返す', () => {
    fs.readdirSync.mockReturnValue(['readme.md', 'config.json'])
    expect(listBackups()).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// runBackup
// ─────────────────────────────────────────────────────────────
describe('runBackup()', () => {
  test('exec に mysqldump コマンドが渡される', (done) => {
    exec.mockImplementation((cmd, cb) => cb(null))

    runBackup((err) => {
      expect(err).toBeNull()
      expect(exec).toHaveBeenCalledTimes(1)
      const cmd = exec.mock.calls[0][0]
      expect(cmd).toContain('mysqldump')
      expect(cmd).toContain('localhost')
      expect(cmd).toContain('root')
      expect(cmd).toContain('mydb')
      done()
    })
  })

  test('コールバックに backup_*.sql 形式のファイル名を返す', (done) => {
    exec.mockImplementation((cmd, cb) => cb(null))

    runBackup((err, filename) => {
      expect(err).toBeNull()
      expect(filename).toMatch(/^backup_.*\.sql$/)
      done()
    })
  })

  test('exec が失敗 → コールバックにエラーを渡す', (done) => {
    const mockErr = new Error('mysqldump: command not found')
    exec.mockImplementation((cmd, cb) => cb(mockErr))

    runBackup((err) => {
      expect(err).toBe(mockErr)
      done()
    })
  })

  test('DB_HOST が未設定 → exec を呼ばずエラーを返す', (done) => {
    delete process.env.DB_HOST

    runBackup((err) => {
      expect(err).toBeInstanceOf(Error)
      expect(exec).not.toHaveBeenCalled()
      done()
    })
  })

  test('DB_PASSWORD が未設定 → エラーを返す', (done) => {
    delete process.env.DB_PASSWORD

    runBackup((err) => {
      expect(err).toBeInstanceOf(Error)
      done()
    })
  })
})
