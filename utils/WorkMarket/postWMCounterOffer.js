import { CONFIG } from "../../config.js";
import { getCookieHeader } from "../cookieStore.js";
import { counterError, readCounterForm, verifyCounterDetails } from './wmCounterVerification.js';

function getCookies(targetUrl) {
  try {
    return getCookieHeader("WorkMarket", targetUrl);
  } catch (error) {
    console.error(`Error reading cookies: ${error.message}`);
    return null;
  }
}

function formatWorkMarketDate(date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function formatWorkMarketTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })
    .format(date)
    .replace(/\s/g, "")
    .toLowerCase();
}

function buildWMCounterOfferFormData({
  csrfToken,
  hourlyRate,
  hours,
  distance,
  options = {},
}) {
  const travelExpenses =
    options.travelExpense ??
    (distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0);
  const isHourlyCounter = options.payType !== "fixed";
  const priceType = options.priceType ?? (isHourlyCounter ? "2" : "1");
  const rescheduleOption =
    options.rescheduleOption ??
    (options.counterDate?.mode === 'hours' || options.isRequestedWindow ? "window" : "time");

  const formData = new URLSearchParams({
    _tk: csrfToken,
    is_internal_pricing: "false",
    has_tiered_pricing: "false",
    priceType,
    price_negotiation: "on",
    pricing: priceType,
    initial_per_hour_price: "",
    initial_number_of_hours: "",
    additional_per_hour_price: "",
    max_blended_number_of_hours: "",
    per_unit_price: "",
    max_number_of_units: "",
    per_hour_price: isHourlyCounter ? hourlyRate.toString() : "",
    max_number_of_hours: isHourlyCounter ? hours.toString() : "",
    flat_price:
      options.flatPrice ??
      (isHourlyCounter ? "" : Number(options.baseAmount ?? 0).toFixed(2)),
    additional_expenses: travelExpenses.toString(),
    expires_on: "",
    expires_on_time: "",
    note: "",
    isform: "true",
    submit: "",
  });

  if (options.note) {
    formData.set("note", options.note);
  }

  if (options.counterDate?.start instanceof Date) {
    formData.set("schedule_negotiation", "on");
    const hasWindowEnd =
      rescheduleOption === "window" &&
      options.counterDate.end instanceof Date;
    formData.set("reschedule_option", rescheduleOption);
    formData.set("from", formatWorkMarketDate(options.counterDate.start));
    formData.set("fromtime", formatWorkMarketTime(options.counterDate.start));

    if (hasWindowEnd) {
      formData.set("to", formatWorkMarketDate(options.counterDate.end));
      formData.set("totime", formatWorkMarketTime(options.counterDate.end));
    }
  }

  return formData;
}

export async function postWMCounterOffer(
  workOrderId,
  hourlyRate,
  hours,
  distance,
  options = {},
  dependencies = {}
) {
  if (CONFIG.TEST_MODE) {
    const result = { status: 'test', message: 'TEST: WM counter simulated; no submission', workOrderId,
      formData: buildWMCounterOfferFormData({ csrfToken: 'test', hourlyRate, hours, distance, options }).toString() };
    console.log(result);
    return result;
  }
  try {
    const fetchPage = dependencies.fetch || fetch;
    const requestUrl = `https://www.workmarket.com/assignments/negotiate/${workOrderId}`;
    const detailsUrl = `https://www.workmarket.com/assignments/details/${workOrderId}`;
    const cookies = (dependencies.getCookies || getCookies)(requestUrl);

    if (!cookies) {
      throw new Error("Failed to retrieve cookies");
    }

    // WorkMarket serves the modal only for AJAX GETs. Read its actual token
    // and availability before attempting a mutation; never treat a 404 as a form.
    const formResponse = await fetchPage(requestUrl, {
      headers: { cookie: cookies, 'X-Requested-With': 'XMLHttpRequest', Referer: detailsUrl },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (!formResponse.ok) throw counterError(`WorkMarket counter form HTTP ${formResponse.status}; nothing was submitted.`, 'WM_COUNTER_FORM_UNAVAILABLE');
    const { token: CSRFToken, form } = readCounterForm(await formResponse.text(), workOrderId);
    if (options.counterDate && !form.find('input[name="schedule_negotiation"]:not([disabled])').length) {
      throw counterError('WorkMarket does not allow schedule negotiation for this ticket; nothing was submitted.');
    }

    const formData = buildWMCounterOfferFormData({
      csrfToken: CSRFToken,
      hourlyRate,
      hours,
      distance,
      options,
    });
    const headers = {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookies,
      Referer: `https://www.workmarket.com/assignments/details/${workOrderId}`,
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    const requestBody = formData.toString();

    const response = await fetchPage(requestUrl, {
      method: "POST",
      headers,
      body: requestBody,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    const responseLocation = response.headers.get("location");

    if (!response.ok && response.status !== 302) {
      throw new Error(
        `Counter offer request failed with status ${response.status}; acceptance is not confirmed. Check the ticket before retrying.`
      );
    }

    if (response.status === 302 && new URL(responseLocation || '/', requestUrl).href !== detailsUrl) {
      throw counterError('WorkMarket redirected away from the expected ticket; counter not confirmed.');
    }
    if (responseText.includes('Page Not Found')) throw counterError('WorkMarket returned Page Not Found; counter not confirmed.');
    // A redirect or HTTP 200 alone is not acceptance. Never retry the POST:
    // read back the proposal and check schedule, price and travel instead.
    const verification = await fetchPage(detailsUrl, {
      headers: { cookie: (dependencies.getCookies || getCookies)(detailsUrl), 'cache-control': 'no-cache' },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (!verification.ok) throw counterError(`WorkMarket verification HTTP ${verification.status}; check the ticket before retrying.`);
    verifyCounterDetails(await verification.text(), formData, options);

    console.log(
      `Counter offer sent successfully for work order ${workOrderId}`
    );
    return {
      ok: true,
      verified: true,
      status: response.status,
      location: responseLocation,
      responseUrl: response.url,
    };
  } catch (error) {
    console.error("Error sending counter offer:", error.message);
    throw error;
  }
}

export { buildWMCounterOfferFormData, formatWorkMarketDate, formatWorkMarketTime };
