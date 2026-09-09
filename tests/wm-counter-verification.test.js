import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../config.js';
import { postWMCounterOffer, buildWMCounterOfferFormData } from '../utils/WorkMarket/postWMCounterOffer.js';

const form = `<form id="negotiate-work" action="/assignments/negotiate/7872739912">
<input name="_tk" value="fresh-form-token"><input name="schedule_negotiation" type="checkbox"></form>`;
// Markup labels from WorkMarket's assignments.js negotiation template.
const saved = `<html><body><h5>Status: Counteroffered with a Flat Rate</h5>
<div><h5><strong>Proposed Date / Time:</strong></h5><p>Wed, Sep 16, 2026 9:00AM EDT</p></div>
<div><h5><strong>Proposed Price:</strong></h5><table><tr><td>Initial Rate</td><td>$398.16</td></tr>
<tr><td>Additional expenses</td><td>$130.00</td></tr></table></div></body></html>`;
const options = { payType: 'fixed', baseAmount: 398.16446183, travelExpense: 130,
  counterDate: { start: new Date('2026-09-16T09:00:00-04:00'), end: new Date('2026-09-16T09:00:00-04:00') } };
const response = (status, text, location) => ({ status, ok: status >= 200 && status < 300,
  headers: new Headers(location ? { location } : {}), text: async () => text });

async function run(replies, overrides = {}) {
  const previousMode = CONFIG.TEST_MODE;
  const calls = [];
  CONFIG.TEST_MODE = false; // Network is replaced entirely; tests never submit.
  try {
    const result = await postWMCounterOffer('7872739912', 100, 4, 91.1, { ...options, ...overrides }, {
      getCookies: () => 'CSRFToken=old-cookie-token; workmarketSessionId=test',
      fetch: async (url, init) => {
        calls.push({ url, ...init });
        if (!replies.length) throw new Error('Unexpected extra request');
        return replies.shift();
      },
    });
    return { result, calls };
  } finally { CONFIG.TEST_MODE = previousMode; }
}

test('fixed counter uses consistent pricing=1, cents and no hourly fields', () => {
  const data = buildWMCounterOfferFormData({ csrfToken: 'test', hourlyRate: 100, hours: 4, distance: 91.1, options });
  assert.equal(data.get('pricing'), '1');
  assert.equal(data.get('priceType'), '1');
  assert.equal(data.get('flat_price'), '398.16');
  assert.equal(data.get('per_hour_price'), '');
  assert.equal(data.get('max_number_of_hours'), '');
  assert.equal(data.get('fromtime'), '9:00am');
  assert.equal(data.get('schedule_negotiation'), 'on');
});

test('successful counter reads AJAX form token and verifies redirect with a GET', async () => {
  const { result, calls } = await run([response(200, form), response(302, '', '/assignments/details/7872739912'), response(200, saved)]);
  assert.equal(result.verified, true);
  assert.equal(calls[0].headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(new URLSearchParams(calls[1].body).get('_tk'), 'fresh-form-token');
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.equal(calls[2].url, 'https://www.workmarket.com/assignments/details/7872739912');
});

test('302 followed by unchanged Available/Apply is not success', async () => {
  await assert.rejects(run([response(200, form), response(302, '', '/assignments/details/7872739912'),
    response(200, '<body>Available 5:30 AM<button>Apply</button></body>')]), /has not confirmed/);
});

test('applied or counteroffered at original 05:30 does not confirm the requested 09:00', async () => {
  await assert.rejects(run([response(200, form), response(302, '', '/assignments/details/7872739912'),
    response(200, saved.replace('9:00AM', '5:30AM'))]), /schedule does not confirm/);
});

test('window verification requires both bounds; a mismatched travel amount also fails', async () => {
  const windowOptions = { counterDate: { ...options.counterDate, end: new Date('2026-09-16T10:00:00-04:00'), mode: 'hours' } };
  await assert.rejects(run([response(200, form), response(200, 'OK'), response(200, saved)], windowOptions), /schedule does not confirm/);
  const { result } = await run([response(200, form), response(200, 'OK'), response(200, saved.replace('9:00AM EDT', '9:00AM - 10:00AM EDT'))], windowOptions);
  assert.equal(result.verified, true);
  await assert.rejects(run([response(200, form), response(200, 'OK'), response(200, saved.replace('$130.00', '$0.00'))]), /price\/travel/);
});

test('login, error, missing and external redirects cannot succeed or leak cookies', async () => {
  for (const location of ['/login', '/assignments/details/7872739912?error=1', 'https://example.com/', null]) {
    await assert.rejects(run([response(200, form), response(302, '', location)]), /redirected away/);
  }
  await assert.rejects(run([response(200, form), response(302, '', '/assignments/details/7872739912'), response(302, '', '/login')]), /verification HTTP/);
});

test('unavailable or invalid preflight form prevents POST', async () => {
  await assert.rejects(run([response(404, 'Page Not Found')]), /nothing was submitted/);
  await assert.rejects(run([response(200, '<html>Login</html>')]), /form is unavailable/);
  await assert.rejects(run([response(200, form.replace('name="schedule_negotiation"', 'disabled name="schedule_negotiation"'))]), /does not allow schedule/);
});
