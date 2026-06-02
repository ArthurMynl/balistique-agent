import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { MailError } from "../domain/mail.js";
import { mailAgentSettings } from "../lib/mail-agent-settings.js";
import { parseMailRulesMarkdown } from "../lib/mail-rules-md.js";

const resolveRulesPath = (path: Path.Path, configured: string): string =>
  configured.startsWith("/") ? configured : path.join(process.cwd(), configured);

export class MailRulesConfig extends Context.Service<MailRulesConfig>()("@app/MailRulesConfig", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const rulesPath = yield* Config.string("MAIL_RULES_PATH").pipe(
      Config.withDefault("mail/RULES.md"),
    );

    const absolutePath = resolveRulesPath(path, rulesPath);
    const exists = yield* fs.exists(absolutePath);
    if (!exists) {
      return yield* new MailError({
        reason: "InvalidConfig",
        message: `Mail rules file not found: ${absolutePath} (set MAIL_RULES_PATH or create mail/RULES.md)`,
      });
    }

    const contents = yield* fs.readFileString(absolutePath).pipe(
      Effect.mapError(
        (error) =>
          new MailError({
            reason: "InvalidConfig",
            message: `Failed to read mail rules at ${absolutePath}: ${error.message}`,
          }),
      ),
    );

    const parsed = parseMailRulesMarkdown(contents);
    const agent = mailAgentSettings(parsed.triageFolders);

    return {
      rulesPath: absolutePath,
      triageFolders: parsed.triageFolders,
      triageGuide: parsed.triageGuide,
      dryRun: agent.dryRun,
      pollIntervalSeconds: agent.pollIntervalSeconds,
      batchSize: agent.batchSize,
      maxActionsPerCycle: agent.maxActionsPerCycle,
      aiEnabled: agent.aiEnabled,
      allowDelete: agent.allowDelete,
      preferArchiveOverDelete: agent.preferArchiveOverDelete,
      aiFallbackAction: agent.aiFallbackAction,
      classifierBodyMaxChars: agent.classifierBodyMaxChars,
    } as const;
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
