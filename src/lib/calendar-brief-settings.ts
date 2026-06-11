export type CalendarBriefSettings = {
  readonly briefEnabled: boolean;
  readonly briefTime: string;
  readonly timezone: string;
  readonly dryRun: boolean;
  readonly checkIntervalSeconds: number;
  readonly briefGuide: string;
  readonly includeCalendarNames: ReadonlyArray<string>;
};

export const defaultCalendarBriefSettings = (): CalendarBriefSettings => ({
  briefEnabled: true,
  briefTime: "07:00",
  timezone: "Europe/Paris",
  dryRun: false,
  checkIntervalSeconds: 60,
  briefGuide: [
    "Rédige un brief matinal concis pour Discord (moins de 1800 caractères), en français.",
    "Commence par une ligne sur le niveau d'activité de la journée.",
    "Quand une section Météo est fournie, ouvre avec un bref résumé météo et des conseils (parapluie, protection UV).",
    "Liste les événements par ordre chronologique avec les heures de début.",
    "Signale les conflits, les enchaînements serrés et les longues plages libres.",
    "Texte brut uniquement ; pas de titres markdown.",
  ].join("\n"),
  includeCalendarNames: [],
});
