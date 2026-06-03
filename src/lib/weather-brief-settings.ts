export type WeatherRulesSettings = {
  readonly enabled: boolean;
  readonly uvHighThreshold: number;
  readonly precipChanceThresholdPercent: number;
};

export const defaultWeatherRulesSettings = (): WeatherRulesSettings => ({
  enabled: true,
  uvHighThreshold: 6,
  precipChanceThresholdPercent: 40,
});
