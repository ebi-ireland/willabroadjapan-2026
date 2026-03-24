// =====================
// connection.js
// パス: /db/connection.js
// 用途: MySQLへの接続設定
// =====================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mysql = require('mysql2')

const pool = mysql.createPool({
  host:              process.env.DB_HOST,
  user:              process.env.DB_USER,
  password:          process.env.DB_PASSWORD,
  database:          process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
})

pool.getConnection((err, conn) => {
  if (err) {
    console.error('MySQL接続エラー:', err)
    return
  }
  console.log('MySQLに接続しました')
  conn.release()
})

module.exports = pool