import { BunServices } from "@effect/platform-bun";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  MailClassifierTriageResponse,
  type MailAction,
  type MailMessage,
  type MailTriageCategory,
} from "../domain/mail.js";
import { extractJsonObject, formatMessageForClassifier } from "../lib/mail-action.js";
import { categoryToAction, type MailTriageFolders } from "../lib/mail-triage.js";
import { MailRulesConfig } from "./mail-rules-config.js";
import { AiLive, generateText } from "./openai-subscription.js";

const ClassifierPlatformLive = Layer.mergeAll(BunServices.layer, BunHttpClient.layer);

const ClassifierAiLive = AiLive.pipe(Layer.provide(ClassifierPlatformLive));

const buildClassifierInstructions = (folders: MailTriageFolders, triageGuide: string): string =>
  [
    "You are an email triage agent for a personal iCloud INBOX. Goal: empty INBOX into the right folders.",
    "INBOX is unprocessed only — always pick a destination folder; never leave mail in INBOX.",
    "Classify each message from its subject, body, and context. Do not route by sender address alone.",
    "Follow the mailbox rules below (from mail/RULES.md).",
    "",
    triageGuide,
    "",
    "Respond with JSON only (no markdown):",
    '{"category":"Action"|"Waiting"|"ReadLater"|"Notifications"|"Archive","reason":"short explanation"}',
    "",
    "Folder mapping:",
    `- Action → "${folders.action}"`,
    `- Waiting → "${folders.waiting}"`,
    `- ReadLater → "${folders.readLater}"`,
    `- Notifications → "${folders.notifications}"`,
    `- Archive → "${folders.archive}"`,
    "",
    "Never use delete.",
  ].join("\n");

export type MailClassification = {
  readonly action: MailAction;
  readonly reason: string;
};

const applySafetyPolicies = (
  action: MailAction,
  reason: string,
  rules: typeof MailRulesConfig.Service,
): MailClassification => {
  if (action._tag === "Delete" && !rules.allowDelete) {
    return {
      action: categoryToAction("ReadLater", rules.triageFolders),
      reason: `delete disallowed; read later (${reason})`,
    };
  }

  if (action._tag === "Delete" && rules.preferArchiveOverDelete) {
    return {
      action: categoryToAction("Archive", rules.triageFolders),
      reason: `prefer archive over delete (${reason})`,
    };
  }

  if (action._tag === "MoveToFolder") {
    const allowed = new Set([
      rules.triageFolders.action,
      rules.triageFolders.waiting,
      rules.triageFolders.readLater,
      rules.triageFolders.notifications,
      rules.triageFolders.archive,
    ]);
    if (!allowed.has(action.folder)) {
      return {
        action: categoryToAction("ReadLater", rules.triageFolders),
        reason: `unknown folder "${action.folder}"; using Read Later`,
      };
    }
  }

  return { action, reason };
};

const triageCategoryToClassification = (
  category: MailTriageCategory,
  reason: string,
  folders: MailTriageFolders,
): MailClassification => ({
  action: categoryToAction(category, folders),
  reason,
});

export class MailClassifier extends Context.Service<MailClassifier>()("@app/MailClassifier", {
  make: Effect.gen(function* () {
    const rules = yield* MailRulesConfig;
    const classifierInstructions = buildClassifierInstructions(
      rules.triageFolders,
      rules.triageGuide,
    );

    const classify = (message: MailMessage) =>
      Effect.gen(function* () {
        const prompt = [
          classifierInstructions,
          "",
          formatMessageForClassifier(message, rules.classifierBodyMaxChars),
        ].join("\n");

        const raw = yield* generateText(prompt).pipe(
          Effect.timeout("120 seconds"),
          Effect.catch(() => Effect.succeed("")),
        );

        if (raw.trim().length === 0) {
          return {
            action: rules.aiFallbackAction,
            reason: "classifier timeout or empty response",
          };
        }

        const parsed = yield* Effect.try({
          try: () => JSON.parse(extractJsonObject(raw)) as unknown,
          catch: () => "invalid JSON" as const,
        }).pipe(Effect.catch(() => Effect.succeed(null)));

        if (parsed === null) {
          return {
            action: rules.aiFallbackAction,
            reason: "classifier response is not JSON",
          };
        }

        return yield* Schema.decodeUnknownEffect(MailClassifierTriageResponse)(parsed).pipe(
          Effect.map((response) => {
            const base = triageCategoryToClassification(
              response.category,
              response.reason,
              rules.triageFolders,
            );
            return applySafetyPolicies(base.action, base.reason, rules);
          }),
          Effect.catch(() =>
            Effect.succeed({
              action: rules.aiFallbackAction,
              reason: "classifier JSON schema decode failed",
            }),
          ),
        );
      }).pipe(Effect.provide(ClassifierAiLive));

    return { classify } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

export const MailClassifierLive = MailClassifier.layer.pipe(Layer.provide(ClassifierAiLive));
