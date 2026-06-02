import type { MailAction, MailTriageCategory } from "../domain/mail.js";

export type MailTriageFolders = {
  readonly action: string;
  readonly waiting: string;
  readonly readLater: string;
  readonly notifications: string;
  readonly archive: string;
};

export const categoryToAction = (
  category: MailTriageCategory,
  folders: MailTriageFolders,
): MailAction => {
  switch (category) {
    case "Action":
      return { _tag: "MoveToFolder", folder: folders.action };
    case "Waiting":
      return { _tag: "MoveToFolder", folder: folders.waiting };
    case "ReadLater":
      return { _tag: "MoveToFolder", folder: folders.readLater };
    case "Notifications":
      return { _tag: "MoveToFolder", folder: folders.notifications };
    case "Archive":
      return { _tag: "MoveToFolder", folder: folders.archive };
  }
};

export const normalizeTriageFolder = (name: string): string => name.trim();
