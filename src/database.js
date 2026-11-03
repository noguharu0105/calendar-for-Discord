const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// データベースの保存先
const dataDir = path.join(__dirname, "..", "data");

// dataフォルダがなければ作成
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SQLiteデータベースを開く
const db = new Database(path.join(dataDir, "calendar.db"));

// 予定を保存するテーブルを作成
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    memo TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 日付ごとの予定を取得する関数
function getEventsByDate(guildId, eventDate) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE guild_id = ? AND event_date = ?
    ORDER BY start_time ASC
  `).all(guildId, eventDate);
}

// 予定を追加する関数
function addEvent(event) {
  const result = db.prepare(`
    INSERT INTO events (
      guild_id,
      title,
      event_date,
      start_time,
      end_time,
      memo,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.guildId,
    event.title,
    event.eventDate,
    event.startTime || null,
    event.endTime || null,
    event.memo || null,
    event.createdBy
  );

  return result.lastInsertRowid;
}

// 予定をIDで取得する関数
function getEventById(eventId, guildId) {
  return db.prepare(`
    SELECT *
    FROM events
    WHERE id = ? AND guild_id = ?
  `).get(eventId, guildId);
}

module.exports = {
  db,
  getEventsByDate,
  getEventsByMonth,
  addEvent,
  getEventById,
};

// 指定した月の予定を取得する
function getEventsByMonth(guildId, year, month) {
  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const lastDate = new Date(year, month + 1, 0).getDate();

  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;

  return db.prepare(`
    SELECT * FROM events
    WHERE guild_id = ?
      AND event_date >= ?
      AND event_date <= ?
    ORDER BY event_date ASC, start_time ASC
  `).all(guildId, firstDay, lastDay);
}