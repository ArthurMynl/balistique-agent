import type { DiscordConversationTurn } from "../domain/discord.js";
import { DiscordMaxConversationTurns } from "../domain/discord.js";

export type DiscordPromptMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

/** Minimal message shape for pure history mapping (no discord.js). */
export type DiscordHistoryMessage = {
  readonly id: string;
  readonly authorId: string;
  readonly authorDisplayName: string;
  readonly isBot: boolean;
  readonly content: string;
  readonly createdTimestamp: number;
};

const boilerplateBotMessages = new Set([
  "Hey! Send a question and I'll help.",
  "Sorry, something went wrong while generating a reply.",
  "Sorry, something went wrong.",
]);

export const isDiscordBoilerplateBotMessage = (content: string): boolean =>
  boilerplateBotMessages.has(content.trim());

export const formatDiscordUserTurn = (displayName: string, content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length === 0) return "";
  return `${displayName}: ${trimmed}`;
};

/** Keep only the most recent turns so prompts stay within model limits. */
export const trimConversationHistory = (
  turns: ReadonlyArray<DiscordConversationTurn>,
  maxTurns = DiscordMaxConversationTurns,
): ReadonlyArray<DiscordConversationTurn> =>
  turns.length <= maxTurns ? turns : turns.slice(-maxTurns);

/** Merge consecutive turns from the same role (e.g. split Discord reply chunks). */
export const mergeAdjacentConversationTurns = (
  turns: ReadonlyArray<DiscordConversationTurn>,
): ReadonlyArray<DiscordConversationTurn> => {
  const merged: Array<DiscordConversationTurn> = [];

  for (const turn of turns) {
    const last = merged.at(-1);
    if (last !== undefined && last.role === turn.role) {
      merged[merged.length - 1] = {
        role: turn.role,
        content: `${last.content}\n\n${turn.content}`,
      };
    } else {
      merged.push(turn);
    }
  }

  return merged;
};

export const messagesToConversationTurns = (
  messages: ReadonlyArray<DiscordHistoryMessage>,
  currentMessageId: string,
  botUserId: string,
): ReadonlyArray<DiscordConversationTurn> => {
  const turns: Array<DiscordConversationTurn> = [];

  for (const msg of messages) {
    if (msg.id === currentMessageId) continue;
    if (msg.isBot && msg.authorId !== botUserId) continue;

    const isBot = msg.authorId === botUserId;
    const content = msg.content.trim();
    if (content.length === 0) continue;
    if (isBot && isDiscordBoilerplateBotMessage(content)) continue;

    turns.push({
      role: isBot ? "assistant" : "user",
      content: isBot ? content : formatDiscordUserTurn(msg.authorDisplayName, content),
    });
  }

  return mergeAdjacentConversationTurns(turns);
};

/** Shape system + trimmed history + current user message for the model. */
export const buildConversationPrompt = (
  instructions: string,
  history: ReadonlyArray<DiscordConversationTurn>,
  prompt: string,
): ReadonlyArray<DiscordPromptMessage> => {
  const conversation: Array<DiscordPromptMessage> = [{ role: "system", content: instructions }];

  for (const turn of trimConversationHistory(history)) {
    const content = turn.content.trim();
    if (content.length === 0) continue;
    conversation.push({ role: turn.role, content });
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 0) {
    conversation.push({ role: "user", content: trimmedPrompt });
  }

  return conversation;
};
