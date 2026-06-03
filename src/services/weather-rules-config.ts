import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { WeatherError } from "../domain/weather.js";
import { defaultWeatherRulesSettings } from "../lib/weather-brief-settings.js";
import type { WeatherRulesRuntime } from "../lib/weather-locale.js";
import { parseWeatherRulesMarkdown } from "../lib/weather-rules-md.js";

const resolveRulesPath = (path: Path.Path, configured: string): string =>
  configured.startsWith("/") ? configured : path.join(process.cwd(), configured);

export class WeatherRulesConfig extends Context.Service<WeatherRulesConfig>()(
  "@app/WeatherRulesConfig",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const rulesPath = yield* Config.string("WEATHER_RULES_PATH").pipe(
        Config.withDefault("weather/RULES.md"),
      );
      const envLatitude = yield* Config.number("WEATHER_LATITUDE").pipe(Config.option);
      const envLongitude = yield* Config.number("WEATHER_LONGITUDE").pipe(Config.option);

      const envCoords = {
        envLatitude: envLatitude._tag === "Some" ? envLatitude.value : undefined,
        envLongitude: envLongitude._tag === "Some" ? envLongitude.value : undefined,
      } as const;

      const absolutePath = resolveRulesPath(path, rulesPath);
      const exists = yield* fs.exists(absolutePath);
      if (!exists) {
        const defaults = defaultWeatherRulesSettings();
        return {
          rulesPath: absolutePath,
          configured: false,
          ...defaults,
          ...envCoords,
          enabled: false,
        } satisfies WeatherRulesRuntime & { rulesPath: string; configured: boolean };
      }

      const contents = yield* fs.readFileString(absolutePath).pipe(
        Effect.mapError(
          (error) =>
            new WeatherError({
              reason: "InvalidConfig",
              message: `Failed to read weather rules at ${absolutePath}: ${error.message}`,
            }),
        ),
      );

      const settings = parseWeatherRulesMarkdown(contents);

      return {
        rulesPath: absolutePath,
        configured: true,
        ...settings,
        ...envCoords,
      } satisfies WeatherRulesRuntime & { rulesPath: string; configured: boolean };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
