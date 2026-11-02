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
} = require("discord.js");

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

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  let calendar = "```text\n";
  calendar += "日 月 火 水 木 金 土\n";

  // 1日の前に空白を入れる
  calendar += "   ".repeat(firstDay.getDay());

  // 日付を並べる
  for (let day = 1; day <= lastDate; day++) {
    calendar += String(day).padStart(2, " ") + " ";

    // 土曜日まで来たら改行する
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
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`calendar_prev_${year}_${month}`)
      .setLabel("◀ 前の月")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`calendar_next_${year}_${month}`)
      .setLabel("次の月 ▶")
      .setStyle(ButtonStyle.Primary)
  );
}

// Botが起動したとき
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} としてログインしました！`);
});

// コマンドとボタンの処理
client.on("interactionCreate", async (interaction) => {
  try {
    // /calendar コマンド
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName !== "calendar") return;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      await interaction.reply({
        embeds: [createCalendarEmbed(year, month)],
        components: [createCalendarButtons(year, month)],
      });

      return;
    }

    // カレンダーのボタン
    if (interaction.isButton()) {
      const parts = interaction.customId.split("_");

      if (parts[0] !== "calendar") return;

      const direction = parts[1];
      let year = Number(parts[2]);
      let month = Number(parts[3]);

      if (direction === "prev") {
        month--;
      } else if (direction === "next") {
        month++;
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
        components: [createCalendarButtons(year, month)],
      });
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