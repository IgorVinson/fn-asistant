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

function proposedSection(dom, label) {
  const heading = dom('h5').filter((i, e) => dom(e).text().trim() === label).first();
  return heading.parent().text().replace(/\s+/g, ' ').trim();
}

function containsDateTime(text, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value;
  const monthIndex = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(part('month')) + 1;
  const normalized = text.replace(/\s+/g, ' ');
  const numericDate = new RegExp(`\\b0?${monthIndex}/0?${part('day')}/${part('year')}\\b`);
  const namedDate = new RegExp(`\\b${part('month')}[a-z]*\\.?\\s+0?${part('day')},?\\s+${part('year')}\\b`, 'i');
  const time = new RegExp(`\\b0?${part('hour')}:${part('minute')}\\s*${part('dayPeriod')}\\b`, 'i');
  return (numericDate.test(normalized) || namedDate.test(normalized)) && time.test(normalized);
}

export function verifyCounterDetails(html, formData, options) {
  const dom = cheerio.load(html);
  dom('script,style').remove();
  const pageText = dom('body').text();
  if (!/\bCounteroffered\b/i.test(pageText)) {
    throw counterError('WorkMarket has not confirmed a counteroffer. The request may not have been saved; check the ticket before retrying.');
  }
  if (options.counterDate?.start) {
    const schedule = proposedSection(dom, 'Proposed Date / Time:');
    if (!containsDateTime(schedule, options.counterDate.start) ||
        (formData.get('reschedule_option') === 'window' && !containsDateTime(schedule, options.counterDate.end))) {
      throw counterError('WorkMarket counter schedule does not confirm the requested arrival time/window. Check the ticket before retrying.');
    }
  }
  const pricing = proposedSection(dom, 'Proposed Price:').replace(/,/g, '');
  const expectedRate = formData.get('pricing') === '1' ? formData.get('flat_price') : formData.get('per_hour_price');
  const amounts = [expectedRate, formData.get('additional_expenses')].filter(value => Number(value) > 0);
  if (!pricing || amounts.some(value => !new RegExp(`(?:^|[^\\d.])${Number(value).toFixed(2).replace('.', '\\.')}($|[^\\d.])`).test(pricing))) {
    throw counterError('WorkMarket counter price/travel is not confirmed. Check the ticket before retrying.');
  }
  return true;
}
