import * as Schema from "effect/Schema";
import { Tool } from "effect/unstable/ai";

export const WeatherTodayTool = Tool.make("weather_today", {
  description:
    "Today's weather from your calendar localization (all-day event: 📍 City, Location, or Localization title). Defaults to Paris if none. Optional .env lat/lon override.",
  success: Schema.String,
  failure: Schema.String,
}).annotate(Tool.Readonly, true);
