import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { MailAction } from "../domain/mail.js";
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

    const runCycle = Effect.fn("MailAutomation.runCycle")(function* () {
      const folder = icloud.folder;
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

        const alreadyDone = yield* store.has(folder, envelope.uid, undefined);
        if (alreadyDone) {
          skipped += 1;
          continue;
        }

        if (!rulesConfig.aiEnabled) {
          left += 1;
          yield* Effect.log(
            `[mail] UID ${envelope.uid} leave — AI disabled (from: ${envelope.from})`,
          );
          continue;
        }

        const message = yield* mail.readMessage({ uid: envelope.uid, folder });
        const messageId = message.messageId;

        if (yield* store.has(folder, envelope.uid, messageId)) {
          skipped += 1;
          continue;
        }

        const classified = yield* classifier.classify(message);
        const action: MailAction = classified.action;
        const reason = classified.reason;

        if (action._tag === "Leave") {
          left += 1;
          yield* Effect.log(
            `[mail] UID ${envelope.uid} leave — ${reason} (from: ${envelope.from})`,
          );
          continue;
        }

        yield* Effect.log(
          `[mail] UID ${envelope.uid} ${mailActionTag(action)} — ${reason} (from: ${envelope.from}, subject: ${envelope.subject})${rulesConfig.dryRun ? " [dry-run]" : ""}`,
        );

        if (!rulesConfig.dryRun) {
          const applied = yield* mail.applyAction({ uid: envelope.uid, folder, action }).pipe(
            Effect.as(true),
            Effect.tapError((error) =>
              Effect.logError(`[mail] action failed for UID ${envelope.uid}: ${error.message}`),
            ),
            Effect.catch(() => Effect.succeed(false)),
          );
          if (!applied) {
            errors += 1;
            continue;
          }
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
        processed += 1;
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
          yield* runCycle();
          yield* Effect.sleep(`${rulesConfig.pollIntervalSeconds} seconds`);
        }),
      );
    });

    return { runCycle, runLoop } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
