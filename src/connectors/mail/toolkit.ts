import { Toolkit } from "effect/unstable/ai";
import { MailListEnvelopesTool, MailListFoldersTool, MailReadMessageTool } from "./tools.js";

export const MailToolkit = Toolkit.make(
  MailListFoldersTool,
  MailListEnvelopesTool,
  MailReadMessageTool,
);
