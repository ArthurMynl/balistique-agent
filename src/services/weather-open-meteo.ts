import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { PARIS_WEATHER } from "../domain/weather.js";
import { WeatherError } from "../domain/weather.js";
import { isoDateKey, zonedDateParts } from "../lib/calendar-context.js";
import { hasEnvCoordinates } from "../lib/weather-locale.js";
import { Weather, type WeatherTodayInput } from "./weather.js";
import { WeatherRulesConfig } from "./weather-rules-config.js";

const ForecastResponse = Schema.Struct({
  timezone: Schema.String,
  current: Schema.Struct({
    temperature_2m: Schema.Number,
    weather_code: Schema.Number,
  }),
  daily: Schema.Struct({
    weather_code: Schema.Array(Schema.Number),
    temperature_2m_max: Schema.Array(Schema.Number),
    temperature_2m_min: Schema.Array(Schema.Number),
    precipitation_probability_max: Schema.optional(Schema.Array(Schema.NullOr(Schema.Number))),
    uv_index_max: Schema.optional(Schema.Array(Schema.NullOr(Schema.Number))),
  }),
});

const firstNumber = (values: ReadonlyArray<number | null | undefined> | undefined): number => {
  if (values === undefined || values.length === 0) return 0;
  const value = values[0];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

export const WeatherOpenMeteoLive = Layer.effect(
  Weather,
  Effect.gen(function* () {
    const rules = yield* WeatherRulesConfig;
    const http = yield* HttpClient.HttpClient;

    const today = Effect.fn("Weather.today")(function* (input: WeatherTodayInput) {
      if (!rules.enabled || !rules.configured) {
        return yield* new WeatherError({
          reason: "InvalidConfig",
          message:
            "Weather is disabled or weather/RULES.md is missing (create weather/RULES.md and set enabled: true)",
        });
      }

      const ref = input.date ?? new Date();
      const timeZone =
        input.timeZone !== undefined && input.timeZone.trim().length > 0
          ? input.timeZone.trim()
          : PARIS_WEATHER.timeZone;

      const coords = hasEnvCoordinates(rules)
        ? {
            latitude: rules.envLatitude!,
            longitude: rules.envLongitude!,
            label: `${rules.envLatitude!.toFixed(4)}, ${rules.envLongitude!.toFixed(4)} (.env coords)`,
          }
        : {
            latitude: PARIS_WEATHER.latitude,
            longitude: PARIS_WEATHER.longitude,
            label: PARIS_WEATHER.label,
          };

      const dateKey = isoDateKey(zonedDateParts(ref, timeZone));

      const forecastQuery = new URLSearchParams({
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        timezone: timeZone,
        forecast_days: "1",
        current: "temperature_2m,weather_code",
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
          "uv_index_max",
        ].join(","),
      });

      const forecastRequest = HttpClientRequest.get(
        `https://api.open-meteo.com/v1/forecast?${forecastQuery.toString()}`,
      );

      const forecastResponse = yield* http.execute(forecastRequest).pipe(
        Effect.mapError(
          (error) =>
            new WeatherError({
              reason: "FetchFailed",
              message: error instanceof Error ? error.message : String(error),
            }),
        ),
      );

      const forecast = yield* HttpClientResponse.schemaBodyJson(ForecastResponse)(
        forecastResponse,
      ).pipe(
        Effect.mapError(
          () => new WeatherError({ reason: "ParseFailed", message: "Forecast response invalid" }),
        ),
      );

      return {
        dateKey,
        locationLabel: coords.label,
        timezone: forecast.timezone,
        currentTempC: forecast.current.temperature_2m,
        currentWeatherCode: forecast.current.weather_code,
        dailyMinC: forecast.daily.temperature_2m_min[0] ?? forecast.current.temperature_2m,
        dailyMaxC: forecast.daily.temperature_2m_max[0] ?? forecast.current.temperature_2m,
        dailyWeatherCode: forecast.daily.weather_code[0] ?? forecast.current.weather_code,
        precipProbabilityMaxPercent: firstNumber(forecast.daily.precipitation_probability_max),
        uvIndexMax: firstNumber(forecast.daily.uv_index_max),
      };
    });

    return { today } as const;
  }),
);
