// =====================
// connection.js
// パス: /db/connection.js
// 用途: MySQLへの接続設定
// =====================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mysql = require('mysql2')

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})

connection.connect((err) => {
  if (err) {
    console.error('MySQL接続エラー:', err)
    return
  }
  console.log('MySQLに接続しました')
})

module.exports = connection