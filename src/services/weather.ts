import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { WeatherError, WeatherToday } from "../domain/weather.js";

export type WeatherTodayInput = {
  /** When omitted, uses Europe/Paris. */
  readonly timeZone?: string | undefined;
  readonly date?: Date | undefined;
};

export type WeatherService = {
  readonly today: (input: WeatherTodayInput) => Effect.Effect<WeatherToday, WeatherError>;
};

export class Weather extends Context.Service<Weather, WeatherService>()("@app/Weather") {}
