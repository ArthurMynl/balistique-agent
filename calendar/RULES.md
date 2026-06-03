# Calendar rules

## Agent settings

briefEnabled: true
briefTime: 07:00
timezone: Europe/Paris
dryRun: false
checkIntervalSeconds: 60

## Localization

Where you are today drives weather and forecast timezone. If none match today, the agent assumes **Paris** (`Europe/Paris`).

Recognized events (including **multi-day** spans — e.g. vacation June 1–8 counts on each day in range):

- Title in the list below **and** a **Location** field (e.g. title `Vacances`, location `New York, NY, États-Unis`)
- All-day title `Localization` / `Location` (list below), with or without Location
- Title starting with `📍` (e.g. `📍 Lyon`)
- Title like `Location: Bordeaux`

defaultCity: Paris
defaultCountry: France
defaultTimezone: Europe/Paris

- Localization
- Location
- Vacances
- Vacation
- Voyage

## Calendars

Leave empty to include all iCloud calendars. Otherwise list exact calendar display names:

- Personnel

## Brief guide

Write a concise morning brief for Discord (under 1800 characters).
Lead with a one-line overview of how busy the day is.
When a Weather section is provided, open with a short weather snapshot and any tips (umbrella, UV protection).
List events in chronological order with start times.
Call out conflicts, back-to-back blocks, and large gaps.
Use plain text; no markdown headings.
The localization event is not listed in the brief.
