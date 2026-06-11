import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { MailEnvelope } from "../domain/mail.js";
import { formatErrorMessage } from "../lib/error-message.js";
import { mailActionTag } from "../lib/mail-action.js";
import { MailClassifier } from "./mail-classifier.js";
import { MailProcessedStore } from "./mail-processed-store.js";
import { MailRulesConfig } from "./mail-rules-config.js";
import { Mail } from "./mail.js";
import { IcloudMailConfig } from "./mail-icloud-config.js";

export class MailAutomation extends Context.Service<MailAutomation>()("@app/MailAutomation", {
  make: Effect.gen(function* () {
    const mail = yield* Mail;
    const icloud = yield* IcloudMailConfig;
    const rulesConfig = yield* MailRulesConfig;
    const store = yield* MailProcessedStore;
    const classifier = yield* MailClassifier;

    const processEnvelope = Effect.fn("MailAutomation.processEnvelope")(function* (
      folder: string,
      envelope: MailEnvelope,
    ) {
      const alreadyDone = yield* store.has(folder, envelope.uid, undefined);
      if (alreadyDone) return "skipped" as const;

      if (!rulesConfig.aiEnabled) {
        yield* Effect.log(
          `[mail] UID ${envelope.uid} leave — AI disabled (from: ${envelope.from})`,
        );
        return "left" as const;
      }

      const message = yield* mail.readMessage({ uid: envelope.uid, folder });
      const messageId = message.messageId;

      if (yield* store.has(folder, envelope.uid, messageId)) return "skipped" as const;

      const { action, reason } = yield* classifier.classify(message);

      if (action._tag === "Leave") {
        yield* Effect.log(`[mail] UID ${envelope.uid} leave — ${reason} (from: ${envelope.from})`);
        return "left" as const;
      }

      yield* Effect.log(
        `[mail] UID ${envelope.uid} ${mailActionTag(action)} — ${reason} (from: ${envelope.from}, subject: ${envelope.subject})${rulesConfig.dryRun ? " [dry-run]" : ""}`,
      );

      if (!rulesConfig.dryRun) {
        yield* mail.applyAction({ uid: envelope.uid, folder, action });
      }

      yield* store.mark({
        messageId,
        folder,
        uid: envelope.uid,
        actionTag: mailActionTag(action),
        reason,
        processedAt: new Date().toISOString(),
        dryRun: rulesConfig.dryRun,
      });
      return "processed" as const;
    });

    const runCycle = Effect.fn("MailAutomation.runCycle")(function* () {
      const folder = icloud.folder;
      yield* Effect.log(`[mail] cycle start — folder ${folder}`);

      const envelopes = yield* mail.listEnvelopes({
        folder,
        limit: rulesConfig.batchSize,
        unreadOnly: true,
      });

      let processed = 0;
      let skipped = 0;
      let left = 0;
      let errors = 0;

      for (const envelope of envelopes) {
        if (processed >= rulesConfig.maxActionsPerCycle) break;

        const outcome = yield* processEnvelope(folder, envelope).pipe(
          Effect.tapError((error) =>
            Effect.logError(`[mail] UID ${envelope.uid} failed: ${formatErrorMessage(error)}`),
          ),
          Effect.catch(() => Effect.succeed("error" as const)),
        );

        switch (outcome) {
          case "processed":
            processed += 1;
            break;
          case "skipped":
            skipped += 1;
            break;
          case "left":
            left += 1;
            break;
          case "error":
            errors += 1;
            break;
        }
      }

      yield* Effect.log(
        `[mail] cycle done — listed ${envelopes.length}, processed ${processed}, skipped ${skipped}, left ${left}, errors ${errors}`,
      );
    });

    const runLoop = Effect.fn("MailAutomation.runLoop")(function* () {
      yield* Effect.log(
        `[mail] agent started — poll every ${rulesConfig.pollIntervalSeconds}s, dryRun=${rulesConfig.dryRun}`,
      );
      return yield* Effect.forever(
        Effect.gen(function* () {
          yield* runCycle().pipe(
            Effect.tapError((error) =>
              Effect.logError(`[mail] cycle failed: ${formatErrorMessage(error)}`),
            ),
            Effect.catch(() => Effect.void),
          );
          yield* Effect.sleep(`${rulesConfig.pollIntervalSeconds} seconds`);
        }),
      );
    });

    return { runCycle, runLoop } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
