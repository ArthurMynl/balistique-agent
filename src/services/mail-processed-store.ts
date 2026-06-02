import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { MailProcessedEntry, MailProcessedStoreFile, MailStoreError } from "../domain/mail.js";
import { processedEntryKey } from "../lib/mail-action.js";
import { MailRulesConfig } from "./mail-rules-config.js";

class MailAgentStateConfig extends Context.Service<MailAgentStateConfig>()(
  "@app/MailAgentStateConfig",
  {
    make: Effect.gen(function* () {
      const path = yield* Path.Path;
      const home = yield* Config.string("HOME");
      const stateDir = yield* Config.string("BALISTIQUE_STATE_DIR").pipe(
        Config.orElse(() => Config.succeed(path.join(home, ".balistique-agent"))),
      );
      const rules = yield* MailRulesConfig;
      const storeFileName = rules.dryRun ? "mail-processed-dry-run.json" : "mail-processed.json";

      return {
        stateDir,
        storePath: path.join(stateDir, storeFileName),
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

const emptyStore = (): MailProcessedStoreFile => ({ version: 1, entries: [] });

export class MailProcessedStore extends Context.Service<MailProcessedStore>()(
  "@app/MailProcessedStore",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const config = yield* MailAgentStateConfig;

      const ensureStateDir = Effect.fn("MailProcessedStore.ensureStateDir")(function* () {
        const exists = yield* fs.exists(config.stateDir);
        if (!exists) {
          yield* fs.makeDirectory(config.stateDir, { recursive: true });
        }
      });

      const loadStore = Effect.fn("MailProcessedStore.loadStore")(function* () {
        yield* ensureStateDir();
        const exists = yield* fs.exists(config.storePath);
        if (!exists) return emptyStore();

        const contents = yield* fs.readFileString(config.storePath).pipe(
          Effect.mapError(
            (error) =>
              new MailStoreError({
                reason: "ReadFailed",
                message: error.message,
              }),
          ),
        );

        return yield* Schema.decodeEffect(MailProcessedStoreFile)(JSON.parse(contents)).pipe(
          Effect.mapError(
            (error) =>
              new MailStoreError({
                reason: "DecodeFailed",
                message: error.message,
              }),
          ),
        );
      });

      const saveStore = Effect.fn("MailProcessedStore.saveStore")(function* (
        store: MailProcessedStoreFile,
      ) {
        yield* ensureStateDir();
        const encoded = yield* Schema.encodeEffect(MailProcessedStoreFile)(store);
        yield* fs.writeFileString(config.storePath, `${JSON.stringify(encoded, null, 2)}\n`).pipe(
          Effect.mapError(
            (error) =>
              new MailStoreError({
                reason: "WriteFailed",
                message: error.message,
              }),
          ),
        );
      });

      const has = Effect.fn("MailProcessedStore.has")(function* (
        folder: string,
        uid: number,
        messageId: string | undefined,
      ) {
        const store = yield* loadStore();
        const key = processedEntryKey(folder, uid, messageId);
        return store.entries.some(
          (entry) => processedEntryKey(entry.folder, entry.uid, entry.messageId) === key,
        );
      });

      const mark = Effect.fn("MailProcessedStore.mark")(function* (entry: MailProcessedEntry) {
        const store = yield* loadStore();
        const key = processedEntryKey(entry.folder, entry.uid, entry.messageId);
        const withoutDuplicate = store.entries.filter(
          (existing) =>
            processedEntryKey(existing.folder, existing.uid, existing.messageId) !== key,
        );
        yield* saveStore({
          version: 1,
          entries: [...withoutDuplicate, entry],
        });
      });

      return { has, mark } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(MailAgentStateConfig.layer),
  );
}
