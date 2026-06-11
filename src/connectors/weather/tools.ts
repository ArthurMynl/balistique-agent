import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const WeatherTodayTool = Tool.make("weather_today", {
  description: "Today's weather for Paris (Europe/Paris). Optional .env lat/lon override.",
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);
