import { normalizeTriageFolder, type MailTriageFolders } from "./mail-triage.js";

export type ParsedMailRules = {
  readonly triageFolders: MailTriageFolders;
  readonly triageGuide: string;
};

const defaultTriageFolders: MailTriageFolders = {
  action: "Action",
  waiting: "Waiting",
  readLater: "Read Later",
  notifications: "Notifications",
  archive: "Archive",
};

const defaultTriageGuide = [
  "INBOX is unprocessed only — empty it into a folder based on message content.",
  "Action — mail requiring the user to do something (reply, pay, confirm, follow up).",
  "Waiting — user already acted; ball is in someone else's court.",
  "Notifications — automated FYI with no task.",
  "Read later — newsletters and optional reading.",
  "Archive — clearly done or reference-only with no future task.",
].join("\n");

const slug = (heading: string): string =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

type SectionBucket = {
  folders: Record<string, string>;
  triageGuideLines: Array<string>;
};

const emptyBucket = (): SectionBucket => ({
  folders: {},
  triageGuideLines: [],
});

const parseKeyValue = (line: string): { key: string; value: string } | undefined => {
  const match = line.trim().match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.+)$/);
  if (!match) return undefined;
  return { key: match[1]!, value: match[2]!.trim() };
};

const assignLine = (bucket: SectionBucket, section: string, line: string): void => {
  const kv = parseKeyValue(line);

  switch (section) {
    case "folders":
      if (kv) bucket.folders[kv.key] = kv.value;
      return;
    case "triage-guide":
    case "agent-guide":
      if (line.trim().length > 0) bucket.triageGuideLines.push(line);
      return;
    default:
      return;
  }
};

export const parseMailRulesMarkdown = (markdown: string): ParsedMailRules => {
  const bucket = emptyBucket();
  let section = "";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      section = slug(heading[1]!);
      continue;
    }
    if (line.trim().startsWith("#")) continue;
    if (section.length === 0) continue;
    assignLine(bucket, section, line);
  }

  const folder = (key: string, fallback: string) =>
    normalizeTriageFolder(bucket.folders[key] ?? "") || fallback;

  const triageFolders: MailTriageFolders = {
    action: folder("action", defaultTriageFolders.action),
    waiting: folder("waiting", defaultTriageFolders.waiting),
    readLater: folder("readLater", defaultTriageFolders.readLater),
    notifications: folder("notifications", defaultTriageFolders.notifications),
    archive: folder("archive", defaultTriageFolders.archive),
  };

  const triageGuide =
    bucket.triageGuideLines.join("\n").trim().length > 0
      ? bucket.triageGuideLines.join("\n").trim()
      : defaultTriageGuide;

  return {
    triageFolders,
    triageGuide,
  };
};
