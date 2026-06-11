import type { ConnectorManifest } from "../domain/connector.js";
import { balistiqueAssistantIdentity, respondInFrenchInstruction } from "../lib/agent-locale.js";
import { CalendarToolkit } from "./calendar/index.js";
import { MailToolkit } from "./mail/index.js";
import { WeatherToolkit } from "./weather/index.js";

const mailManifest: ConnectorManifest = {
  id: "mail",
  description:
    "Boîte iCloud IMAP — lister les dossiers, parcourir les messages, lire le corps. Lecture seule depuis le chat (pas d'envoi/déplacement/suppression).",
  tools: Object.keys(MailToolkit.tools),
};

const calendarManifest: ConnectorManifest = {
  id: "calendar",
  description:
    "Calendriers iCloud CalDAV — lister les calendriers, interroger les événements, en créer. Briefs matinaux envoyés de façon proactive.",
  tools: Object.keys(CalendarToolkit.tools),
};

const weatherManifest: ConnectorManifest = {
  id: "weather",
  description: "Météo locale via Open-Meteo pour Paris (Europe/Paris).",
  tools: Object.keys(WeatherToolkit.tools),
};

/** Static manifests for all registered connectors (extend when adding connectors). */
export const connectorManifests: ReadonlyArray<ConnectorManifest> = [
  mailManifest,
  calendarManifest,
  weatherManifest,
];

export const assistantSystemInstructions = (
  manifests: ReadonlyArray<ConnectorManifest>,
): string => {
  const connectorLines = manifests.map(
    (manifest) => `- ${manifest.id}: ${manifest.description} (tools: ${manifest.tools.join(", ")})`,
  );

  return [
    balistiqueAssistantIdentity,
    respondInFrenchInstruction,
    "Tu disposes de connecteurs (comme des plugins OpenClaw ou des serveurs Hermes MCP) qui exposent des outils.",
    "Quand l'utilisateur parle de courriel ou de mail, appelle les outils mail_* — n'invente pas de messages.",
    "Utilise mail_list_folders pour les noms de dossiers, mail_list_envelopes pour parcourir, mail_read_message pour le corps complet.",
    "Quand l'utilisateur parle d'agenda, de planning ou de rendez-vous, appelle les outils calendar_* — n'invente pas d'événements.",
    "Utilise calendar_list_calendars pour voir les calendriers.",
    "Utilise calendar_query_events pour une plage (début/fin AAAA-MM-JJ) ; calendar_list_events pour un seul jour.",
    "Utilise calendar_create_event pour ajouter un événement (AAAA-MM-JJ ou AAAA-MM-JJTHH:mm dans le fuseau configuré).",
    "Quand l'utilisateur demande la météo du jour ou quoi porter, appelle weather_today — prévisions Paris.",
    "Pour la conversation générale sans données en direct, réponds directement sans outils.",
    "",
    "Connecteurs disponibles :",
    ...connectorLines,
  ].join("\n");
};
