import { CONFIG } from '../../config.js';
import { persistArrivalWindowMinutes } from '../configPersistence.js';

export function arrivalWindowLabel() {
  const value = CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES || 0;
  return value ? `${value} min` : 'OFF';
}

export async function updateArrivalWindow(service, input, persist = persistArrivalWindowMinutes) {
  if (service.arrivalUpdatePending) {
    service.sendMessage('⏳ Saving the previous change. Try again shortly.');
    return;
  }
  const text = String(input).trim();
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isInteger(value) || value > 240) {
    service.sendMessage('❌ Enter whole minutes from 0 to 240. Example: /arrival 90. 0 = OFF.');
    return;
  }
  service.arrivalUpdatePending = true;
  try {
    await persist(value);
    CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES = value;
    if (service.waitingForInput === 'arrival') service.clearWaitingState();
    service.sendMessage(`✅ Arrival window: ${arrivalWindowLabel()}. Saved. Applies to new evaluations immediately; existing tickets are unchanged.`);
  } catch {
    service.sendMessage('❌ Could not save config.js. Arrival window was not changed. Try again.');
  } finally {
    service.arrivalUpdatePending = false;
  }
}

export function setupArrivalWindowSettings(service, persist = persistArrivalWindowMinutes) {
  const authorized = chat => chat && String(chat.id) === String(service.chatId);
  service.bot.onText(/^\/arrival(?:@\w+)?(?:\s+(.+))?\s*$/, async (msg, match) => {
    if (!authorized(msg.chat)) return;
    service.clearWaitingState();
    if (match[1]) return updateArrivalWindow(service, match[1], persist);
    service.waitingForInput = 'arrival';
    service.sendMessage(`🕒 Arrival window after earlier appointment: ${arrivalWindowLabel()}\nChoose below or send whole minutes (0–240).\n/arrival 90 · /arrival 0 to disable.`, {
      reply_markup: { inline_keyboard: [[
        { text: '60 min', callback_data: 'arrival:60' },
        { text: '90 min', callback_data: 'arrival:90' },
        { text: 'OFF', callback_data: 'arrival:0' },
      ]] },
    });
  });
  service.bot.on('callback_query', async query => {
    if (!authorized(query.message?.chat)) return;
    const match = query.data?.match(/^arrival:(0|60|90)$/);
    if (!match) return;
    await service.bot.answerCallbackQuery(query.id).catch(() => {});
    return updateArrivalWindow(service, match[1], persist);
  });
}
