import { Toolkit } from "effect/unstable/ai";
import { WeatherTodayTool } from "./tools.js";

export const WeatherToolkit = Toolkit.make(WeatherTodayTool);
