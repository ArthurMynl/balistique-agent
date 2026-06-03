import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { CalendarBriefSentFile, CalendarBriefStoreError } from "../domain/calendar.js";

class CalendarBriefStateConfig extends Context.Service<CalendarBriefStateConfig>()(
  "@app/CalendarBriefStateConfig",
  {
    make: Effect.gen(function* () {
      const path = yield* Path.Path;
      const home = yield* Config.string("HOME");
      const stateDir = yield* Config.string("BALISTIQUE_STATE_DIR").pipe(
        Config.orElse(() => Config.succeed(path.join(home, ".balistique-agent"))),
      );

      return {
        stateDir,
        storePath: path.join(stateDir, "calendar-brief-sent.json"),
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

const emptyStore = (): CalendarBriefSentFile => ({ version: 1, sentDates: [] });

export class CalendarBriefSentStore extends Context.Service<CalendarBriefSentStore>()(
  "@app/CalendarBriefSentStore",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const config = yield* CalendarBriefStateConfig;

      const ensureStateDir = Effect.fn("CalendarBriefSentStore.ensureStateDir")(function* () {
        const exists = yield* fs.exists(config.stateDir);
        if (!exists) {
          yield* fs.makeDirectory(config.stateDir, { recursive: true });
        }
      });

      const loadStore = Effect.fn("CalendarBriefSentStore.loadStore")(function* () {
        yield* ensureStateDir();
        const exists = yield* fs.exists(config.storePath);
        if (!exists) return emptyStore();

        const contents = yield* fs.readFileString(config.storePath).pipe(
          Effect.mapError(
            (error) =>
              new CalendarBriefStoreError({
                reason: "ReadFailed",
                message: error.message,
              }),
          ),
        );

        return yield* Schema.decodeEffect(CalendarBriefSentFile)(JSON.parse(contents)).pipe(
          Effect.mapError(
            (error) =>
              new CalendarBriefStoreError({
                reason: "DecodeFailed",
                message: error.message,
              }),
          ),
        );
      });

      const saveStore = Effect.fn("CalendarBriefSentStore.saveStore")(function* (
        store: CalendarBriefSentFile,
      ) {
        yield* ensureStateDir();
        const encoded = yield* Schema.encodeEffect(CalendarBriefSentFile)(store);
        yield* fs.writeFileString(config.storePath, JSON.stringify(encoded, null, 2)).pipe(
          Effect.mapError(
            (error) =>
              new CalendarBriefStoreError({
                reason: "WriteFailed",
                message: error.message,
              }),
          ),
        );
      });

      const has = Effect.fn("CalendarBriefSentStore.has")(function* (dateKey: string) {
        const store = yield* loadStore();
        return store.sentDates.includes(dateKey);
      });

      const mark = Effect.fn("CalendarBriefSentStore.mark")(function* (dateKey: string) {
        const store = yield* loadStore();
        if (store.sentDates.includes(dateKey)) return;
        yield* saveStore({
          version: 1,
          sentDates: [...store.sentDates, dateKey],
        });
      });

      return { has, mark } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(CalendarBriefStateConfig.layer),
  );
}
