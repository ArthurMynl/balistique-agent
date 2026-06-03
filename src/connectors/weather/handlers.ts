import * as Effect from "effect/Effect";
import { formatWeatherToday, weatherInsights } from "../../lib/weather-open-meteo.js";
import { Weather } from "../../services/weather.js";
import { WeatherRulesConfig } from "../../services/weather-rules-config.js";
import { WeatherToolkit } from "./toolkit.js";

export const WeatherToolkitHandlersLive = WeatherToolkit.toLayer(
  Effect.gen(function* () {
    const weather = yield* Weather;
    const rules = yield* WeatherRulesConfig;

    return {
      weather_today: () =>
        weather.today({}).pipe(
          Effect.map((snapshot) => {
            const insights = weatherInsights({
              precipProbabilityMaxPercent: snapshot.precipProbabilityMaxPercent,
              precipChanceThresholdPercent: rules.precipChanceThresholdPercent,
              uvIndexMax: snapshot.uvIndexMax,
              uvHighThreshold: rules.uvHighThreshold,
              currentWeatherCode: snapshot.currentWeatherCode,
              dailyWeatherCode: snapshot.dailyWeatherCode,
            });
            return formatWeatherToday(snapshot, insights);
          }),
          Effect.mapError((error) => error.message),
        ),
    };
  }),
);
