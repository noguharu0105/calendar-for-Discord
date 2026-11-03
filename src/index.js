require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

// データベースの機能を読み込む
const {
  addEvent,
  getEventsByMonth,
} = require("./database");

// Botの作成
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// /calendar コマンドの定義
const commands = [
  new SlashCommandBuilder()
    .setName("calendar")
    .setDescription("カレンダーを表示します")
    .toJSON(),
];

// Discordにコマンドを登録する
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN
  );

  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands }
  );

  console.log("✅ /calendar コマンドを登録しました！");
}

// カレンダーを作る
function createCalendarEmbed(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  let calendar = "```text\n";
  calendar += "日 月 火 水 木 金 土\n";

  calendar += "   ".repeat(firstDay.getDay());

  for (let day = 1; day <= lastDate; day++) {
    calendar += String(day).padStart(2, " ") + " ";

    if (new Date(year, month, day).getDay() === 6) {
      calendar += "\n";
    }
  }

  calendar += "\n```";

  return new EmbedBuilder()
    .setTitle(`📅 ${year}年${month + 1}月`)
    .setDescription(calendar)
    .setColor(0x3498db)
    .setFooter({ text: "Calendar Bot" });
}

// カレンダー操作ボタンを作る
function createCalendarButtons(year, month) {
  const navigationRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`calendar_prev_${year}_${month}`)
      .setLabel("◀ 前の月")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`calendar_next_${year}_${month}`)
      .setLabel("次の月 ▶")
      .setStyle(ButtonStyle.Primary)
  );

  const addRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("calendar_add")
      .setLabel("予定を追加")
      .setEmoji("➕")
      .setStyle(ButtonStyle.Success)
  );

  const eventsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`calendar_events_${year}_${month}`)
      .setLabel("今月の予定一覧")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Primary)
  );

  return [navigationRow, addRow, eventsRow];
}

// 予定追加フォームを作る
function createEventModal() {
  const modal = new ModalBuilder()
    .setCustomId("calendar_event_modal")
    .setTitle("予定を追加");

  const titleInput = new TextInputBuilder()
    .setCustomId("event_title")
    .setLabel("予定名")
    .setPlaceholder("例：プログラミング勉強会")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const dateInput = new TextInputBuilder()
    .setCustomId("event_date")
    .setLabel("日付（YYYY-MM-DD）")
    .setPlaceholder("例：2026-11-10")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const startTimeInput = new TextInputBuilder()
    .setCustomId("event_start_time")
    .setLabel("開始時間（HH:mm）")
    .setPlaceholder("例：15:00")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const endTimeInput = new TextInputBuilder()
    .setCustomId("event_end_time")
    .setLabel("終了時間（HH:mm）")
    .setPlaceholder("例：16:00")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const memoInput = new TextInputBuilder()
    .setCustomId("event_memo")
    .setLabel("メモ")
    .setPlaceholder("予定についての補足")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(dateInput),
    new ActionRowBuilder().addComponents(startTimeInput),
    new ActionRowBuilder().addComponents(endTimeInput),
    new ActionRowBuilder().addComponents(memoInput)
  );

  return modal;
}

// 日付の形式と実在する日付を確認する
function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

// 時刻の形式を確認する
function isValidTime(time) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// 今月の予定一覧を作る
function createEventsEmbed(year, month, events) {
  const embed = new EmbedBuilder()
    .setTitle(`📋 ${year}年${month + 1}月の予定一覧`)
    .setColor(0x2ecc71);

  if (events.length === 0) {
    embed.setDescription("この月に登録されている予定はありません。");
    return embed;
  }

  const eventDescriptions = events.slice(0, 20).map((event) => {
    const time = event.start_time || event.end_time
      ? `${event.start_time || "未設定"} ～ ${event.end_time || "未設定"}`
      : "時間未設定";

    return (
      `📌 **${event.title}**\n` +
      `📅 ${event.event_date}\n` +
      `🕒 ${time}\n` +
      `📝 ${event.memo || "メモなし"}`
    );
  });

  let description = eventDescriptions.join("\n\n");

  if (events.length > 20) {
    description += `\n\nほか ${events.length - 20} 件の予定があります。`;
  }

  embed.setDescription(description);

  embed.setFooter({
    text: `登録件数：${events.length}件`,
  });

  return embed;
}

// Botが起動したとき
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} としてログインしました！`);
});

// コマンドとボタン、フォームの処理
client.on("interactionCreate", async (interaction) => {
  try {
    // /calendar コマンド
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "calendar") return;

      const now = new Date();

      await interaction.reply({
        embeds: [
          createCalendarEmbed(now.getFullYear(), now.getMonth()),
        ],
        components: createCalendarButtons(
          now.getFullYear(),
          now.getMonth()
        ),
      });

      return;
    }

    // ボタンの処理
    if (interaction.isButton()) {

      // 予定追加ボタン
      if (interaction.customId === "calendar_add") {
        await interaction.showModal(createEventModal());
        return;
      }

      // 今月の予定一覧ボタン
      if (interaction.customId.startsWith("calendar_events_")) {
        const parts = interaction.customId.split("_");

        const year = Number(parts[2]);
        const month = Number(parts[3]);

        const events = getEventsByMonth(
          interaction.guildId,
          year,
          month
        );

        await interaction.reply({
          embeds: [createEventsEmbed(year, month, events)],
          ephemeral: true,
        });

        return;
      }

      // 月移動ボタン
      const parts = interaction.customId.split("_");

      if (parts[0] !== "calendar") return;

      const direction = parts[1];
      let year = Number(parts[2]);
      let month = Number(parts[3]);

      if (direction === "prev") {
        month--;
      } else if (direction === "next") {
        month++;
      } else {
        return;
      }

      // 年をまたぐ場合の処理
      if (month < 0) {
        month = 11;
        year--;
      } else if (month > 11) {
        month = 0;
        year++;
      }

      await interaction.update({
        embeds: [createCalendarEmbed(year, month)],
        components: createCalendarButtons(year, month),
      });

      return;
    }

    // 予定追加フォームの送信処理
    if (interaction.isModalSubmit()) {
      if (interaction.customId !== "calendar_event_modal") return;

      const title = interaction.fields
        .getTextInputValue("event_title")
        .trim();

      const eventDate = interaction.fields
        .getTextInputValue("event_date")
        .trim();

      const startTime = interaction.fields
        .getTextInputValue("event_start_time")
        .trim();

      const endTime = interaction.fields
        .getTextInputValue("event_end_time")
        .trim();

      const memo = interaction.fields
        .getTextInputValue("event_memo")
        .trim();

      // 入力チェック
      if (!title) {
        await interaction.reply({
          content: "予定名を入力してください。",
          ephemeral: true,
        });
        return;
      }

      if (!isValidDate(eventDate)) {
        await interaction.reply({
          content:
            "日付は YYYY-MM-DD 形式で、実在する日付を入力してください。",
          ephemeral: true,
        });
        return;
      }

      if (startTime && !isValidTime(startTime)) {
        await interaction.reply({
          content:
            "開始時間は HH:mm 形式で入力してください。例：15:00",
          ephemeral: true,
        });
        return;
      }

      if (endTime && !isValidTime(endTime)) {
        await interaction.reply({
          content:
            "終了時間は HH:mm 形式で入力してください。例：16:00",
          ephemeral: true,
        });
        return;
      }

      if (startTime && endTime && endTime <= startTime) {
        await interaction.reply({
          content: "終了時間は開始時間より後にしてください。",
          ephemeral: true,
        });
        return;
      }

      // SQLiteに予定を保存
      const eventId = addEvent({
        guildId: interaction.guildId,
        title,
        eventDate,
        startTime,
        endTime,
        memo,
        createdBy: interaction.user.id,
      });

      // 登録完了メッセージ
      await interaction.reply({
        content:
          `✅ 予定を登録しました！\n\n` +
          `📌 **${title}**\n` +
          `📅 ${eventDate}\n` +
          `🕒 ${startTime || "未設定"} ～ ${endTime || "未設定"}\n` +
          `📝 ${memo || "メモなし"}\n\n` +
          `予定ID：${eventId}`,
        ephemeral: true,
      });

      return;
    }
  } catch (error) {
    console.error("❌ 処理中にエラーが発生しました:", error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "エラーが発生しました。ターミナルを確認してください。",
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

// 起動処理
async function main() {
  try {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("❌ 起動に失敗しました:", error);
  }
}

main();