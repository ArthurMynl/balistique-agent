import type { WeatherRulesSettings } from "./weather-brief-settings.js";

export type WeatherRulesRuntime = WeatherRulesSettings & {
  readonly envLatitude: number | undefined;
  readonly envLongitude: number | undefined;
};

export const hasEnvCoordinates = (rules: WeatherRulesRuntime): boolean =>
  rules.envLatitude !== undefined &&
  rules.envLongitude !== undefined &&
  Number.isFinite(rules.envLatitude) &&
  Number.isFinite(rules.envLongitude);
