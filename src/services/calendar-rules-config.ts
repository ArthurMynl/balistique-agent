import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { CalendarError } from "../domain/calendar.js";
import { parseCalendarRulesMarkdown } from "../lib/calendar-rules-md.js";

const resolveRulesPath = (path: Path.Path, configured: string): string =>
  configured.startsWith("/") ? configured : path.join(process.cwd(), configured);

export class CalendarRulesConfig extends Context.Service<CalendarRulesConfig>()(
  "@app/CalendarRulesConfig",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const rulesPath = yield* Config.string("CALENDAR_RULES_PATH").pipe(
        Config.withDefault("calendar/RULES.md"),
      );

      const absolutePath = resolveRulesPath(path, rulesPath);
      const exists = yield* fs.exists(absolutePath);
      if (!exists) {
        return yield* new CalendarError({
          reason: "InvalidConfig",
          message: `Calendar rules file not found: ${absolutePath} (set CALENDAR_RULES_PATH or create calendar/RULES.md)`,
        });
      }

      const contents = yield* fs.readFileString(absolutePath).pipe(
        Effect.mapError(
          (error) =>
            new CalendarError({
              reason: "InvalidConfig",
              message: `Failed to read calendar rules at ${absolutePath}: ${error.message}`,
            }),
        ),
      );

      const settings = parseCalendarRulesMarkdown(contents);

      return {
        rulesPath: absolutePath,
        ...settings,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
