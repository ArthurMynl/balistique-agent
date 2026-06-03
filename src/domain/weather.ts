import * as Schema from "effect/Schema";

export const WeatherToday = Schema.Struct({
  dateKey: Schema.String,
  locationLabel: Schema.String,
  timezone: Schema.String,
  currentTempC: Schema.Number,
  currentWeatherCode: Schema.Number,
  dailyMinC: Schema.Number,
  dailyMaxC: Schema.Number,
  dailyWeatherCode: Schema.Number,
  precipProbabilityMaxPercent: Schema.Number,
  uvIndexMax: Schema.Number,
});

export type WeatherToday = typeof WeatherToday.Type;

export class WeatherError extends Schema.TaggedErrorClass<WeatherError>()("WeatherError", {
  reason: Schema.Literals(["InvalidConfig", "GeocodeFailed", "FetchFailed", "ParseFailed"]),
  message: Schema.String,
}) {}
