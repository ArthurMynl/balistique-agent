# Weather rules

## Agent settings

enabled: true
uvHighThreshold: 6
precipChanceThresholdPercent: 40

Location and timezone come from today's **localization** calendar event (see `calendar/RULES.md`). Default: Paris.

Optional override in `.env`: `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` (keeps calendar timezone unless the tool passes an override).
