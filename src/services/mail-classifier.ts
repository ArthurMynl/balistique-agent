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
import { formatErrorMessage } from "../lib/error-message.js";
import { extractJsonObject, formatMessageForClassifier } from "../lib/mail-action.js";
import { categoryToAction, type MailTriageFolders } from "../lib/mail-triage.js";
import { MailRulesConfig } from "./mail-rules-config.js";
import { AiLive, generateText } from "./openai-subscription.js";

const ClassifierPlatformLive = Layer.mergeAll(BunServices.layer, BunHttpClient.layer);

const ClassifierAiLive = AiLive.pipe(Layer.provide(ClassifierPlatformLive));

const buildClassifierInstructions = (folders: MailTriageFolders, triageGuide: string): string =>
  [
    "Tu es un agent de tri de courriel pour une boîte iCloud INBOX personnelle. Objectif : vider l'INBOX vers les bons dossiers.",
    "L'INBOX ne contient que le non traité — choisis toujours un dossier de destination ; ne laisse jamais le mail dans l'INBOX.",
    "Classe chaque message d'après l'objet, le corps et le contexte. Ne trie pas sur l'adresse de l'expéditeur seule.",
    "Suis les règles de la boîte ci-dessous (mail/RULES.md).",
    "",
    triageGuide,
    "",
    "Réponds uniquement en JSON (pas de markdown) :",
    '{"category":"Action"|"Waiting"|"ReadLater"|"Notifications"|"Archive","reason":"explication courte en français"}',
    "",
    "Correspondance des dossiers :",
    `- Action → "${folders.action}"`,
    `- Waiting → "${folders.waiting}"`,
    `- ReadLater → "${folders.readLater}"`,
    `- Notifications → "${folders.notifications}"`,
    `- Archive → "${folders.archive}"`,
    "",
    "N'utilise jamais delete.",
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
      reason: `suppression interdite ; lecture différée (${reason})`,
    };
  }

  if (action._tag === "Delete" && rules.preferArchiveOverDelete) {
    return {
      action: categoryToAction("Archive", rules.triageFolders),
      reason: `archivage préféré à la suppression (${reason})`,
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
        reason: `dossier inconnu « ${action.folder} » ; lecture différée`,
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

    const fallback = (reason: string): MailClassification => ({
      action: rules.aiFallbackAction,
      reason,
    });

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
          return fallback("délai dépassé ou réponse vide du classifieur");
        }

        const parsed = yield* Effect.try({
          try: () => JSON.parse(extractJsonObject(raw)) as unknown,
          catch: () => "invalid JSON" as const,
        }).pipe(Effect.catch(() => Effect.succeed(null)));

        if (parsed === null) {
          return fallback("réponse du classifieur non JSON");
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
          Effect.catch(() => Effect.succeed(fallback("échec du décodage JSON du classifieur"))),
        );
      }).pipe(
        Effect.provide(ClassifierAiLive),
        Effect.tapError((error) =>
          Effect.logError(`[mail] classifier failed: ${formatErrorMessage(error)}`),
        ),
        Effect.catch(() => Effect.succeed(fallback("erreur du classifieur"))),
      );

    return { classify } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}

export const MailClassifierLive = MailClassifier.layer.pipe(Layer.provide(ClassifierAiLive));
