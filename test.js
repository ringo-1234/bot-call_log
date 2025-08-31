// 必要なモジュールのインポート
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const dotenv = require("dotenv");
const fs = require("fs").promises; // Promiseベースのfsモジュールを使用

// .envファイルの読み込み
dotenv.config();

// グローバル変数の定義
const activeCalls = new Map();
const channelSettings = {}; // オブジェクトに変更

// 設定ファイルパスの定義
const SETTINGS_FILE = "./test.json";

// クライアントの初期化
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// スラッシュコマンドの定義
const setchCommand = new SlashCommandBuilder()
  .setName("setch")
  .setDescription("VC通話ログの転送先チャンネルと対象VCを追加設定します。")
  .addChannelOption((option) =>
    option
      .setName("log_channel")
      .setDescription("ログを送信するテキストチャンネル")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)
  )
  .addChannelOption((option) =>
    option
      .setName("vc_channel1")
      .setDescription("ログを記録するVCチャンネル (必須)")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addChannelOption((option) =>
    option
      .setName("vc_channel2")
      .setDescription("ログを記録するVCチャンネル (任意)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addChannelOption((option) =>
    option
      .setName("vc_channel3")
      .setDescription("ログを記録するVCチャンネル (任意)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .toJSON();

const delchCommand = new SlashCommandBuilder()
  .setName("delch")
  .setDescription("登録されているVCチャンネルを削除します。")
  .addChannelOption((option) =>
    option
      .setName("vc_channel1")
      .setDescription("削除するVCチャンネル (必須)")
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addChannelOption((option) =>
    option
      .setName("vc_channel2")
      .setDescription("削除するVCチャンネル (任意)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .addChannelOption((option) =>
    option
      .setName("vc_channel3")
      .setDescription("削除するVCチャンネル (任意)")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildVoice)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .toJSON();

// ボットが起動したときの処理
client.once("ready", async () => {
  console.log(`${client.user.tag}としてログインしました。`);
  const guildIds = process.env.GUILD_IDS.split(",").map((id) => id.trim());

  // スラッシュコマンドの登録
  for (const guildId of guildIds) {
    try {
      await client.application.commands.set(
        [setchCommand, delchCommand],
        guildId
      );
      console.log(`ギルドID ${guildId} にスラッシュコマンドを登録しました。`);
    } catch (error) {
      console.error(
        `ギルドID ${guildId} へのコマンド登録に失敗しました:`,
        error
      );
    }
  }

  // 既存の設定を読み込む
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf8");
    Object.assign(channelSettings, JSON.parse(data));
    console.log("既存の設定を読み込みました。");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("設定ファイルが見つかりません。新しく作成します。");
    } else {
      console.error("設定ファイルの読み込み中にエラーが発生しました:", error);
    }
  }
});

// スラッシュコマンドが実行されたときの処理
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "setch") {
    const logChannel = interaction.options.getChannel("log_channel");
    const newVcChannels = [
      interaction.options.getChannel("vc_channel1"),
      interaction.options.getChannel("vc_channel2"),
      interaction.options.getChannel("vc_channel3"),
    ].filter(Boolean);

    if (!logChannel || newVcChannels.length === 0) {
      return await interaction.reply({
        content:
          "ログ転送先チャンネルと少なくとも1つのVCチャンネルを指定してください。",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const currentSettings = channelSettings[guildId] || {
      logChannelId: logChannel.id,
      vcChannelIds: [],
    };
    const vcChannelIdsToAdd = newVcChannels.map((ch) => ch.id);
    const updatedVcChannelIds = [
      ...new Set([...currentSettings.vcChannelIds, ...vcChannelIdsToAdd]),
    ]; // 重複排除して追加

    // チャンネル設定をオブジェクトに保存
    channelSettings[guildId] = {
      logChannelId: logChannel.id,
      vcChannelIds: updatedVcChannelIds,
    };

    // 設定をJSONファイルに書き込む
    try {
      await fs.writeFile(
        SETTINGS_FILE,
        JSON.stringify(channelSettings, null, 2)
      );
      console.log("設定をファイルに保存しました。");
    } catch (error) {
      console.error("設定ファイルの書き込み中にエラーが発生しました:", error);
      return await interaction.reply({
        content: "設定の保存中にエラーが発生しました。",
        ephemeral: true,
      });
    }

    const newVcChannelNames = newVcChannels
      .map((ch) => `\`#${ch.name}\``)
      .join(", ");
    await interaction.reply({
      content: `設定を保存しました。\nログ転送先チャンネル: **#${logChannel.name}**\n新たに追加された対象VC: ${newVcChannelNames}`,
      ephemeral: true,
    });
  } else if (commandName === "delch") {
    const guildId = interaction.guild.id;
    const settings = channelSettings[guildId];

    if (!settings) {
      return await interaction.reply({
        content: "このサーバーには設定がありません。",
        ephemeral: true,
      });
    }

    const channelsToDelete = [
      interaction.options.getChannel("vc_channel1"),
      interaction.options.getChannel("vc_channel2"),
      interaction.options.getChannel("vc_channel3"),
    ]
      .filter(Boolean)
      .map((ch) => ch.id);

    if (channelsToDelete.length === 0) {
      return await interaction.reply({
        content: "削除するVCチャンネルを指定してください。",
        ephemeral: true,
      });
    }

    const originalVcChannels = settings.vcChannelIds;
    const updatedVcChannelIds = originalVcChannels.filter(
      (id) => !channelsToDelete.includes(id)
    );

    // チャンネル設定を更新
    channelSettings[guildId].vcChannelIds = updatedVcChannelIds;

    // 設定をJSONファイルに書き込む
    try {
      await fs.writeFile(
        SETTINGS_FILE,
        JSON.stringify(channelSettings, null, 2)
      );
      console.log("設定をファイルに保存しました。");
    } catch (error) {
      console.error("設定ファイルの書き込み中にエラーが発生しました:", error);
      return await interaction.reply({
        content: "設定の保存中にエラーが発生しました。",
        ephemeral: true,
      });
    }

    const deletedChannelNames = [
      interaction.options.getChannel("vc_channel1"),
      interaction.options.getChannel("vc_channel2"),
      interaction.options.getChannel("vc_channel3"),
    ]
      .filter(Boolean)
      .map((ch) => `\`#${ch.name}\``)
      .join(", ");

    await interaction.reply({
      content: `以下のVCチャンネルを削除しました: ${deletedChannelNames}`,
      ephemeral: true,
    });
  }
});

// VCの状態が変更されたときの処理
client.on("voiceStateUpdate", (oldState, newState) => {
  const guildId = newState.guild.id;
  const settings = channelSettings[guildId];

  if (!settings) return;

  const logChannel = newState.guild.channels.cache.get(settings.logChannelId);
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const isOldStateVC =
    oldState.channelId && settings.vcChannelIds.includes(oldState.channelId);
  const isNewStateVC =
    newState.channelId && settings.vcChannelIds.includes(newState.channelId);

  // VCに入ったときの処理
  if (!isOldStateVC && isNewStateVC) {
    const vcChannel = newState.channel;
    const member = newState.member;

    // 誰も入っていない状態から一人目が入った場合
    if (vcChannel.members.size === 1) {
      const startTime = new Date();
      activeCalls.set(vcChannel.id, { startTime });

      const embed = new EmbedBuilder()
        .setColor("#2ecc71") // 緑色
        .setTitle("通話開始")
        .addFields(
          { name: "VCチャンネル", value: `<#${vcChannel.id}>`, inline: true },
          { name: "始めた人", value: `<@${member.id}>`, inline: true },
          {
            name: "開始時間",
            value: `<t:${Math.floor(startTime.getTime() / 1000)}:f>`,
            inline: false,
          }
        );

      logChannel.send({ embeds: [embed] });
    }
  }

  // VCから誰もいなくなったときの処理
  if (isOldStateVC && !isNewStateVC) {
    const vcChannel = oldState.channel;

    // VCが空になったか確認
    if (vcChannel.members.size === 0 && activeCalls.has(vcChannel.id)) {
      const callData = activeCalls.get(vcChannel.id);
      const endTime = new Date();
      const duration = Math.abs(endTime - callData.startTime);
      activeCalls.delete(vcChannel.id);

      const durationMinutes = Math.floor(duration / 60000);
      const durationSeconds = Math.floor((duration % 60000) / 1000);
      const formattedDuration = `${durationMinutes}分${durationSeconds}秒`;

      const embed = new EmbedBuilder()
        .setColor("#e74c3c") // 赤色
        .setTitle("通話終了")
        .addFields(
          { name: "VCチャンネル", value: `<#${vcChannel.id}>`, inline: true },
          { name: "通話時間", value: formattedDuration, inline: true }
        );

      logChannel.send({ embeds: [embed] });
    }
  }
});

// ログイン
client.login(process.env.TOKEN);
