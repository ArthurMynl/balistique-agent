import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Cause from "effect/Cause";
import {
  Client,
  Events,
  GatewayIntentBits,
  ThreadAutoArchiveDuration,
  type Message,
  type SendableChannels,
} from "discord.js";
import type { DiscordConversationTurn } from "../domain/discord.js";
import { DiscordError, DiscordHistoryFetchLimit } from "../domain/discord.js";
import {
  type DiscordHistoryMessage,
  formatDiscordUserTurn,
  messagesToConversationTurns,
} from "../lib/discord-conversation.js";
import { makeDiscordThreadName, splitDiscordMessage } from "../lib/discord-message.js";
import { DiscordConfig, extractPrompt } from "./discord-config.js";

const log = (message: string) => {
  console.log(`[balistique/discord] ${message}`);
};

const logError = (message: string, error: unknown) => {
  console.error(`[balistique/discord] ${message}`, error);
};

const shouldHandleMessage = (message: Message, config: typeof DiscordConfig.Service): boolean => {
  if (message.author.bot) return false;
  if (!message.guild) return false;
  return message.guild.id === config.guildId;
};

/** Discord clears the typing indicator after ~10s; refresh while waiting on the model. */
const typingRefreshIntervalMs = 8_000;

const sendText = async (channel: SendableChannels, text: string): Promise<void> => {
  const chunks = splitDiscordMessage(text);

  for (const chunk of chunks) {
    await channel.send({ content: chunk, allowedMentions: { parse: [] } });
  }
};

const startTypingIndicator = (channel: SendableChannels): (() => void) => {
  const sendTyping = () => {
    void channel.sendTyping().catch(() => undefined);
  };

  sendTyping();
  const interval = setInterval(sendTyping, typingRefreshIntervalMs);

  return () => clearInterval(interval);
};

const ensureReplyThread = async (
  message: Message,
  threadName: string,
): Promise<SendableChannels> => {
  const channel = message.channel;

  if (channel.isThread()) {
    return channel;
  }

  if (!channel.isSendable()) {
    throw new Error("Channel is not sendable");
  }

  return message.startThread({
    name: threadName,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
  });
};

const replyInThread = async (message: Message, threadName: string, text: string): Promise<void> => {
  const thread = await ensureReplyThread(message, threadName);
  await sendText(thread, text);
};

const toHistoryMessage = (message: Message, botUserId: string): DiscordHistoryMessage => ({
  id: message.id,
  authorId: message.author.id,
  authorDisplayName: message.author.displayName,
  isBot: message.author.bot,
  content: message.author.id === botUserId ? message.content : extractPrompt(message, botUserId),
  createdTimestamp: message.createdTimestamp,
});

const collectThreadHistory = async (
  channel: SendableChannels,
  currentMessageId: string,
  botUserId: string,
): Promise<ReadonlyArray<DiscordConversationTurn>> => {
  if (!channel.isThread()) return [];

  const fetched = await channel.messages.fetch({ limit: DiscordHistoryFetchLimit });
  let messages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const starter = await channel.fetchStarterMessage().catch(() => null);
  if (starter !== null && !messages.some((msg) => msg.id === starter.id)) {
    messages = [starter, ...messages];
  }

  const historyMessages = messages.map((msg) => toHistoryMessage(msg, botUserId));
  return messagesToConversationTurns(historyMessages, currentMessageId, botUserId);
};

export const makeDiscordClient = (
  config: typeof DiscordConfig.Service,
  runReply: (
    prompt: string,
    history: ReadonlyArray<DiscordConversationTurn>,
  ) => Promise<Exit.Exit<string, unknown>>,
) =>
  Effect.gen(function* () {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    const onMessage = async (message: Message) => {
      const botUserId = client.user?.id;
      if (!botUserId) {
        log("ignored message: bot user id not ready yet");
        return;
      }

      if (!shouldHandleMessage(message, config)) return;

      if (!message.channel.isSendable()) {
        log(`ignored message ${message.id}: channel not sendable`);
        return;
      }

      try {
        if (message.partial) await message.fetch();

        const prompt = extractPrompt(message, botUserId);
        log(`message ${message.id} from ${message.author.tag}: ${JSON.stringify(prompt)}`);

        const threadName = makeDiscordThreadName(prompt, message.author.displayName);
        const replyChannel = await ensureReplyThread(message, threadName);

        if (prompt.length === 0) {
          await sendText(replyChannel, "Hey! Send a question and I'll help.");
          return;
        }

        const stopTyping = startTypingIndicator(replyChannel);

        try {
          const history = await collectThreadHistory(replyChannel, message.id, botUserId);
          log(
            `thread ${replyChannel.id} history: ${history.length} prior turn(s) for message ${message.id}`,
          );

          const exit = await runReply(
            formatDiscordUserTurn(message.author.displayName, prompt),
            history,
          );

          if (Exit.isFailure(exit)) {
            logError(`AI failed for message ${message.id}`, Cause.pretty(exit.cause));
            await sendText(replyChannel, "Sorry, something went wrong while generating a reply.");
            return;
          }

          const reply = exit.value;
          log(
            `replying in thread ${replyChannel.id} for message ${message.id} (${reply.length} chars)`,
          );
          await sendText(replyChannel, reply);
        } finally {
          stopTyping();
        }
      } catch (error) {
        logError(`handler failed for message ${message.id}`, error);
        try {
          const threadName = makeDiscordThreadName("", message.author.displayName);
          await replyInThread(message, threadName, "Sorry, something went wrong.");
        } catch (replyError) {
          logError(`could not send error reply for message ${message.id}`, replyError);
        }
      }
    };

    client.on(Events.MessageCreate, onMessage);

    yield* Effect.tryPromise({
      try: () => client.login(Redacted.value(config.token)),
      catch: (cause) =>
        new DiscordError({
          reason: "LoginFailed",
          message: `Discord login failed: ${String(cause)}`,
        }),
    });

    yield* Effect.log(
      `Discord bot online as ${client.user?.tag ?? "unknown"} (guild ${config.guildId})`,
    );

    return {
      client,
      run: Effect.never,
    } as const;
  });
