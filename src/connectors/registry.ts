import type { ConnectorManifest } from "../domain/connector.js";
import { MailToolkit } from "./mail/index.js";

const mailManifest: ConnectorManifest = {
  id: "mail",
  description:
    "iCloud IMAP mailbox — list folders, list envelopes, read message bodies. Read-only from chat (no send/move/delete).",
  tools: Object.keys(MailToolkit.tools),
};

/** Static manifests for all registered connectors (extend when adding connectors). */
export const connectorManifests: ReadonlyArray<ConnectorManifest> = [mailManifest];

export const assistantSystemInstructions = (
  manifests: ReadonlyArray<ConnectorManifest>,
): string => {
  const connectorLines = manifests.map(
    (manifest) => `- ${manifest.id}: ${manifest.description} (tools: ${manifest.tools.join(", ")})`,
  );

  return [
    "You are Balistique, a helpful personal assistant in a private Discord server.",
    "You have connectors (like OpenClaw plugins or Hermes MCP servers) that expose tools.",
    "When the user asks about email or mail, call the mail_* tools — do not invent messages.",
    "Use mail_list_folders to discover folder names, mail_list_envelopes to scan, mail_read_message for full body.",
    "For general chat without needing live data, answer directly without tools.",
    "",
    "Available connectors:",
    ...connectorLines,
  ].join("\n");
};
