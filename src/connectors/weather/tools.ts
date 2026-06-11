import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const WeatherTodayTool = Tool.make("weather_today", {
  description: "Météo du jour pour Paris (Europe/Paris). Surcharge lat/lon optionnelle via .env.",
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);
