import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CONFIG } from '../config.js';
import { persistArrivalWindowMinutes, persistLeadTimeTierMinPay, replaceArrivalWindowMinutes } from '../utils/configPersistence.js';
import { setupArrivalWindowSettings, updateArrivalWindow } from '../utils/telegram/arrivalWindowSettings.js';

const source = `export const CONFIG = {
  TIME: { ARRIVAL_WINDOW_AFTER_JOB_MINUTES: 90, BUFFER_MINUTES: 0 },
  STRATEGY: { LEAD_TIME_TIERS: [
    { maxLeadHours: 36, minPay: 120 },
  ], },
};`;

function fakeService() {
  const service = {
    chatId: '123', waitingForInput: null, messages: [], callbacks: [], commands: [],
    clearWaitingState() { this.waitingForInput = null; },
    sendMessage(text, options) { this.messages.push({ text, options }); },
  };
  service.bot = {
    onText(regex, handler) { service.commands.push({ regex, handler }); },
    on(event, handler) { service.callbacks.push(handler); },
    async answerCallbackQuery() {},
  };
  service.command = async (text, id = 123) => {
    for (const { regex, handler } of service.commands) {
      const match = text.match(regex);
      if (match) await handler({ chat: { id }, text }, match);
    }
  };
  return service;
}

test('arrival setting persists across reload and concurrent policy updates without losing either', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fn-arrival-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.js');
  await fs.writeFile(file, source);
  await Promise.all([persistArrivalWindowMinutes(75, file), persistLeadTimeTierMinPay(0, 180, file)]);
  const saved = await fs.readFile(file, 'utf8');
  assert.match(saved, /ARRIVAL_WINDOW_AFTER_JOB_MINUTES: 75/);
  assert.match(saved, /minPay: 180/);
  assert.match(saved, /BUFFER_MINUTES: 0/);
  await persistArrivalWindowMinutes(0, file);
  assert.match(await fs.readFile(file, 'utf8'), /ARRIVAL_WINDOW_AFTER_JOB_MINUTES: 0/);
  assert.deepEqual(await fs.readdir(dir), ['config.js']);
});

test('invalid settings or missing keys fail without altering the source', () => {
  for (const value of [-1, 241, 1.5, NaN, Infinity]) {
    assert.throws(() => replaceArrivalWindowMinutes(source, value));
  }
  assert.throws(() => replaceArrivalWindowMinutes('export const CONFIG = {};', 60));
});

test('Telegram command shows buttons, accepts custom minutes and OFF, ignores other chats', async () => {
  const original = CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES;
  const saved = [];
  const service = fakeService();
  setupArrivalWindowSettings(service, async value => saved.push(value));
  try {
    await service.command('/arrival');
    assert.equal(service.waitingForInput, 'arrival');
    assert.equal(service.messages[0].options.reply_markup.inline_keyboard[0].length, 3);
    await service.command('/arrival 75', 999);
    assert.deepEqual(saved, []);
    await service.command('/arrival@MyBot 75');
    assert.equal(CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES, 75);
    await service.callbacks[0]({ id: 'q', message: { chat: { id: 123 } }, data: 'arrival:0' });
    assert.equal(CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES, 0);
    await service.callbacks[0]({ id: 'q', message: { chat: { id: 999 } }, data: 'arrival:90' });
    assert.deepEqual(saved, [75, 0]);
    for (const input of ['90abc', '-1', '1.5', '241', '1e2']) await service.command(`/arrival ${input}`);
    assert.deepEqual(saved, [75, 0]);
  } finally { CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES = original; }
});

test('interactive input applies only after saving, preserves config on failure, and blocks concurrent changes', async () => {
  const original = CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES;
  const service = fakeService();
  service.waitingForInput = 'arrival';
  try {
    await updateArrivalWindow(service, '60', async () => { throw new Error('disk full'); });
    assert.equal(CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES, original);
    assert.equal(service.waitingForInput, 'arrival');
    let release;
    const pending = updateArrivalWindow(service, '60', () => new Promise(resolve => { release = resolve; }));
    assert.equal(CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES, original);
    await updateArrivalWindow(service, '0', async () => assert.fail('concurrent persistence'));
    release();
    await pending;
    assert.equal(CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES, 60);
    assert.equal(service.waitingForInput, null);
  } finally { CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES = original; }
});
