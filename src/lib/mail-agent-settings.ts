import type { MailAction } from "../domain/mail.js";
import { categoryToAction, type MailTriageFolders } from "./mail-triage.js";

export type MailAgentSettings = {
  readonly dryRun: boolean;
  readonly pollIntervalSeconds: number;
  readonly batchSize: number;
  readonly maxActionsPerCycle: number;
  readonly aiEnabled: boolean;
  readonly allowDelete: boolean;
  readonly preferArchiveOverDelete: boolean;
  readonly aiFallbackAction: MailAction;
  readonly classifierBodyMaxChars: number;
};

export const mailAgentSettings = (folders: MailTriageFolders): MailAgentSettings => ({
  dryRun: false,
  pollIntervalSeconds: 300,
  batchSize: 100,
  maxActionsPerCycle: 100,
  aiEnabled: true,
  allowDelete: false,
  preferArchiveOverDelete: true,
  aiFallbackAction: categoryToAction("Action", folders),
  classifierBodyMaxChars: 10_000,
});
