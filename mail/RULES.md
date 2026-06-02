# Mailbox rules

## Folders

Map triage roles to exact iCloud mailbox names (must match Mail.app):

action: Action
waiting: Waiting
readLater: Read Later
notifications: Notifications
archive: Archive

## Triage guide

**INBOX is unprocessed only.** The agent reads each message (subject, body, headers) and
classifies it into a folder. Do not rely on sender address alone — use the full content.

- **Action** — the user must DO something: reply, pay, sign, confirm, book, approve, fix,
  submit, meet a deadline, answer a question, or follow up. If it would go on a to-do list,
  it is Action.
- **Waiting** — the user already acted; the ball is in someone else's court. Examples: "we
  received your request", application under review, awaiting delivery after the user ordered,
  thread where the user sent the last reply and no response is required yet. Not for new
  requests addressed to the user.
- **Notifications** — automated FYI only (shipping, login alerts, promos, status pings) with
  no task for the user.
- **Read later** — optional reading (newsletters, marketing, articles) with no task.
- **Archive** — clearly done, no future value, or reference-only mail that does not fit
  Notifications (e.g. old confirmations after the matter is closed).
- If unsure between Action and Waiting → Action (new work beats "maybe I already handled it").
- If unsure between Waiting and Notifications → Waiting only when a human or process is
  explicitly progressing something the user started.
- If unsure between Read later and Archive → Read later only when the user would genuinely
  read it; otherwise Archive.

## Special rules

- All the squarespace mails should be archived.
