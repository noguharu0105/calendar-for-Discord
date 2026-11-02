const {
  db,
  addEvent,
  getEventsByDate,
} = require("./database");

// テスト用の予定を登録
const eventId = addEvent({
  guildId: "test-server",
  title: "データベースの動作確認",
  eventDate: "2026-11-10",
  startTime: "15:00",
  endTime: "16:00",
  memo: "SQLiteのテスト",
  createdBy: "test-user",
});

// 登録した予定を取得
const events = getEventsByDate(
  "test-server",
  "2026-11-10"
);

console.log("✅ 予定を登録しました！");
console.log("登録した予定ID:", eventId);
console.log(events);

// データベースを閉じる
db.close();