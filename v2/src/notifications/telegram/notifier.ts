import type { DecisionResult } from "../../types/decision.js";
import type { NormalizedJob } from "../../types/job.js";

function formatCounter(decision: DecisionResult): string[] {
  if (!decision.counterOffer) {
    return [];
  }

  const lines: string[] = [];
  if (decision.counterOffer.hourlyRate) {
    lines.push(`Rate: $${decision.counterOffer.hourlyRate}/hr`);
  }
  if (decision.counterOffer.travelExpense !== undefined) {
    lines.push(`Travel: $${decision.counterOffer.travelExpense}`);
  }
  if (decision.counterOffer.counterStart) {
    lines.push(`Counter Start: ${decision.counterOffer.counterStart}`);
  }
  if (decision.counterOffer.counterEnd) {
    lines.push(`Counter End: ${decision.counterOffer.counterEnd}`);
  }
  return lines;
}

export function formatTelegramJobAlert(input: {
  normalized: NormalizedJob;
  decision: DecisionResult;
}): string {
  const comparisonKey = `${input.normalized.platform}:${input.normalized.platformWorkOrderId ?? input.normalized.id}`;
  const lines = [
    `V2 ${input.decision.type.toUpperCase()} [${comparisonKey}]`,
    `Company: ${input.normalized.company}`,
    `Title: ${input.normalized.title}`,
    `Reason: ${input.decision.reason}`,
    `Distance: ${input.normalized.distanceMiles}mi`,
    ...formatCounter(input.decision)
  ];

  return lines.join("\n");
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    throw new Error(`Telegram send failed (${response.status})`);
  }
}
