import * as cheerio from 'cheerio';

export function counterError(message, code = 'WM_COUNTER_UNVERIFIED') {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function readCounterForm(html, workOrderId) {
  const dom = cheerio.load(html);
  const form = dom('form#negotiate-work');
  const expected = `/assignments/negotiate/${workOrderId}`;
  if (form.length !== 1 || form.attr('action') !== expected) {
    throw counterError('WorkMarket counter form is unavailable; nothing was submitted.', 'WM_COUNTER_FORM_UNAVAILABLE');
  }
  const token = form.find('input[name="_tk"]').val();
  if (!token) throw counterError('WorkMarket counter form has no CSRF token; nothing was submitted.');
  return { token, form };
}

function proposedSection(dom, labels) {
  const heading = dom('h5,h6').filter((i, e) =>
    labels.includes(dom(e).text().trim().replace(/:$/, '').toLowerCase())
  ).first();
  // Read only this proposal section, never the original assignment below it.
  return heading.nextUntil('h1,h2,h3,h4,h5,h6,form');
}

function scheduleMatches(text, dates) {
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const tokens = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b|\b(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\.?\s+(\d{1,2}),?\s+(\d{4})\b|\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi;
  let day;
  const actual = [];
  for (const match of text.matchAll(tokens)) {
    if (match[1]) day = `${Number(match[1])}/${Number(match[2])}/${match[3]}`;
    else if (match[4]) day = `${months.indexOf(match[4].slice(0, 3).toLowerCase()) + 1}/${Number(match[5])}/${match[6]}`;
    else actual.push(`${day} ${Number(match[7])}:${match[8]}${match[9].toUpperCase()}`);
  }
  const expected = dates.map(date => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).formatToParts(date);
    const part = type => parts.find(p => p.type === type)?.value;
    return `${part('month')}/${part('day')}/${part('year')} ${part('hour')}:${part('minute')}${part('dayPeriod')}`;
  });
  return actual.length === expected.length && actual.every((value, i) => value === expected[i]);
}

function verifyPricing(dom, section, formData) {
  const rows = section.find('tr');
  const row = labels => rows.filter((i, e) =>
    labels.some(label => dom(e).find('td').first().text().trim().toLowerCase().startsWith(label))
  ).first();
  const budget = row(['new assignment budget', 'initial rate']);
  const expenses = row(['additional expenses']);
  const amount = cell => {
    const match = cell.text().replace(/,/g, '').match(/\$\s*(\d+(?:\.\d{1,2})?)/);
    return match ? Number(match[1]) : NaN;
  };
  const expectedTravel = Number(formData.get('additional_expenses'));
  const actualTravel = expenses.length ? amount(expenses.find('td').last()) : 0;
  if (!budget.length || actualTravel !== expectedTravel) return false;
  if (formData.get('pricing') === '1') {
    return amount(budget.find('td').last()) === Number(formData.get('flat_price'));
  }
  const hourly = budget.text().replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)\s+per hour\s*\(up to\s+(\d+(?:\.\d+)?)\s+hours?\)/i);
  const rate = Number(formData.get('per_hour_price'));
  const hours = Number(formData.get('max_number_of_hours'));
  return !!hourly && Number(hourly[1]) === rate && Number(hourly[2]) === hours &&
    amount(budget.find('td').last()) === Math.round(rate * hours * 100) / 100;
}

export function verifyCounterDetails(html, formData, options) {
  const dom = cheerio.load(html);
  dom('script,style,template,[hidden],.dn').remove();
  const status = dom('h4,h5').filter((i, e) =>
    /\bCounteroffered\b/i.test(dom(e).text()) ||
    /your application is\s+pending/i.test(dom(e).text().replace(/\s+/g, ' '))
  ).first();
  if (!status.length) {
    throw counterError('WorkMarket has not confirmed a counteroffer. The request may not have been saved; check the ticket before retrying.');
  }
  if (options.counterDate?.start) {
    const schedule = proposedSection(dom, ['proposed date / time', 'proposed schedule']);
    const dates = [options.counterDate.start];
    if (formData.get('reschedule_option') === 'window') dates.push(options.counterDate.end);
    if (!scheduleMatches(schedule.text(), dates)) {
      throw counterError('WorkMarket counter schedule does not confirm the requested arrival time/window. Check the ticket before retrying.');
    }
  }
  const pricing = proposedSection(dom, ['proposed price', 'proposed pricing']);
  if (!verifyPricing(dom, pricing, formData)) {
    throw counterError('WorkMarket counter price/travel is not confirmed. Check the ticket before retrying.');
  }
  return true;
}
