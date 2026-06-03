import type { WeatherToday } from "../domain/weather.js";

const wmoLabels: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export const weatherCodeLabel = (code: number): string => wmoLabels[code] ?? `Weather code ${code}`;

const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export const isRainLikelyCode = (code: number): boolean => rainCodes.has(code);

export type WeatherInsightInput = {
  readonly precipProbabilityMaxPercent: number;
  readonly precipChanceThresholdPercent: number;
  readonly uvIndexMax: number;
  readonly uvHighThreshold: number;
  readonly currentWeatherCode: number;
  readonly dailyWeatherCode: number;
};

export const weatherInsights = (input: WeatherInsightInput): ReadonlyArray<string> => {
  const tips: Array<string> = [];
  const rainLikely =
    input.precipProbabilityMaxPercent >= input.precipChanceThresholdPercent ||
    isRainLikelyCode(input.currentWeatherCode) ||
    isRainLikelyCode(input.dailyWeatherCode);

  if (rainLikely) {
    tips.push("Bring an umbrella — rain is likely today.");
  }

  if (input.uvIndexMax >= input.uvHighThreshold) {
    tips.push(`Use UV protection — UV index peaks around ${input.uvIndexMax}.`);
  }

  return tips;
};

export const formatWeatherToday = (
  snapshot: WeatherToday,
  insights: ReadonlyArray<string>,
): string => {
  const lines = [
    `Location: ${snapshot.locationLabel} (${snapshot.timezone})`,
    `Date: ${snapshot.dateKey}`,
    `Now: ${Math.round(snapshot.currentTempC)}°C, ${weatherCodeLabel(snapshot.currentWeatherCode)}`,
    `Today: ${Math.round(snapshot.dailyMinC)}–${Math.round(snapshot.dailyMaxC)}°C, ${weatherCodeLabel(snapshot.dailyWeatherCode)}`,
    `Max rain chance: ${Math.round(snapshot.precipProbabilityMaxPercent)}%`,
    `Max UV index: ${Math.round(snapshot.uvIndexMax * 10) / 10}`,
  ];

  if (insights.length > 0) {
    lines.push("", "Tips:", ...insights.map((tip) => `- ${tip}`));
  }

  return lines.join("\n");
};

export const formatWeatherBriefSection = (
  snapshot: WeatherToday,
  insights: ReadonlyArray<string>,
): string => {
  const summary = [
    `${snapshot.locationLabel}: ${Math.round(snapshot.currentTempC)}°C now, ${weatherCodeLabel(snapshot.currentWeatherCode)}`,
    `High ${Math.round(snapshot.dailyMaxC)}°C / low ${Math.round(snapshot.dailyMinC)}°C`,
    `Rain chance up to ${Math.round(snapshot.precipProbabilityMaxPercent)}%`,
    `UV max ${Math.round(snapshot.uvIndexMax * 10) / 10}`,
  ].join("; ");

  if (insights.length === 0) return summary;
  return `${summary}\nTips: ${insights.join(" ")}`;
};
