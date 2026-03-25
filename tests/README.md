# テストスイート

## ディレクトリ構成

```
tests/
├── setup.js                      # 全テスト共通の環境変数設定
├── unit/
│   ├── sanitize.test.js          # middleware/sanitize.js（入力バリデーション）
│   ├── backup.test.js            # services/backup.js（DBバックアップ）
│   └── diagnosis-calc.test.js    # 合格診断スコア計算ロジック
├── routes/
│   ├── checklist.test.js         # routes/checklist.js（出願チェックリストAPI）
│   ├── simulator.test.js         # routes/simulator.js（学費シミュレータAPI）
│   └── diagnosis.test.js         # routes/diagnosis.js（大学合格診断API）
└── admin/
    └── auth.test.js              # 管理画面 ログイン・セッション認証
```

## テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード（ファイル変更を監視して自動再実行）
npm run test:watch

# カバレッジレポート付き
npm run test:coverage
```

## 各テストの概要

### unit/sanitize.test.js（39テスト）
`middleware/sanitize.js` に含まれる入力バリデーション関数を検証。

| 関数 | テスト内容 |
|---|---|
| `safeId()` | 正常ID・0・負値・非数値・SQLインジェクション |
| `safeStr()` | トリム・最大長切り捨て・非文字列型 |
| `safeInt()` | 範囲内・クランプ・NaN・境界値 |
| `sanitizeText()` | HTMLタグ除去・XSS・プレーンテキスト通過 |
| `sanitizeHtml()` | 許可タグ残存・scriptタグ除去・危険属性除去 |

---

### unit/diagnosis-calc.test.js（25テスト）
ブラウザ側スクリプト `public/scripts/pages/diagnosis.js` の計算ロジックを純粋関数として検証。

| 関数 | テスト内容 |
|---|---|
| `rangeScore()` | 範囲内・境界値・範囲外・不正テーブル |
| `applyWeightCap()` | 重み係数・上限クランプ・同時適用・デフォルト値 |
| 統合シナリオ | 合計スコア積算・合格率計算・閾値判定 |

---

### unit/backup.test.js（8テスト）
`services/backup.js` のファイル操作・コマンド実行を `fs` / `child_process` モックで検証。

| 関数 | テスト内容 |
|---|---|
| `listBackups()` | .sql のみ返す・最新順ソート・エラー時空配列 |
| `runBackup()` | mysqldump呼び出し・ファイル名形式・exec失敗・環境変数未設定 |

---

### routes/checklist.test.js（15テスト）
`routes/checklist.js` を supertest でリクエストし、DB は jest.mock で差し替え。

| エンドポイント | テスト内容 |
|---|---|
| `GET /` | グループ化・ステータス変換（not_started→none等）・未認証401 |
| `POST /init` | テンプレート生成・college_name/universityName両対応・重複409・名前なし400 |
| `PATCH /:id/status` | 3ステータス変換確認・無効値400・非数値ID400 |
| `PATCH /:id/note` | メモ保存・無効ID400 |
| `DELETE /:id` | 削除成功・無効ID400 |

---

### routes/simulator.test.js（12テスト）
`routes/simulator.js` の為替換算・試算計算を検証。

| エンドポイント | テスト内容 |
|---|---|
| `GET /exchange-rates` | DB値返却・空時フォールバック・DB上書き優先・DBエラー500 |
| `POST /calculate` | 計算値精度・奨学金超過時0保証・breakdown構造・手動レート優先・years上限8・years下限1 |

---

### routes/diagnosis.test.js（13テスト）
`routes/diagnosis.js` の大学診断APIを検証。Discord通知は node-fetch をモック。

| エンドポイント | テスト内容 |
|---|---|
| `GET /colleges` | 大学一覧・空配列・DBエラー |
| `GET /config` | キーバリュー変換・空設定・DBエラー |
| `GET /keywords` | キーワード一覧 |
| `GET /scoring` | スコアリングテーブル |
| `POST /notify` | 正常送信・空results・Webhook失敗時サイレント処理 |

---

### admin/auth.test.js（15テスト）
管理画面の認証フロー（ログイン・ログアウト・セッション維持）を検証。

| シナリオ | テスト内容 |
|---|---|
| ログイン | 正常・誤パスワード・空値・Cookieヘッダー確認 |
| auth-check | 未ログイン時false・ログイン後true・リロード維持 |
| ログアウト | ログアウト後false・保護ルート401 |
| requireAuth | 未ログイン401・ログイン後200・別セッション分離 |

---

## テスト方針

### DBモック戦略
実際のMySQL接続は行わず、`jest.mock('../../db/connection')` で差し替え。
各テストで `mockDb.query.mockImplementation()` を使って任意のデータを返す。

```javascript
mockDb.query.mockImplementation((sql, params, cb) => {
  cb(null, [{ id: 1, name: 'テストデータ' }])
})
```

### 認証のテスト
`req.user` を注入するミドルウェアを使い、ログイン済み状態を再現。

```javascript
function authAs(userId = 1) {
  return (req, _res, next) => { req.user = { id: userId }; next() }
}
```

### 外部APIモック
Discord Webhook (`node-fetch`) は `jest.mock()` で差し替え、
ネットワークエラーを発生させる場合は `mockRejectedValueOnce` を使用。

---

## カバレッジ対象

```
routes/**/*.js
middleware/**/*.js
services/**/*.js
```

`npm run test:coverage` を実行すると `coverage/` ディレクトリにHTMLレポートが生成されます。
