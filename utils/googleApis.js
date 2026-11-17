import { auth, gmail } from "googleapis/build/src/apis/gmail/index.js";
import { calendar } from "googleapis/build/src/apis/calendar/index.js";

// The `googleapis` package root eagerly loads every Google API (~200s on this
// machine). Import only Gmail + Calendar, which is all the agent uses.
export const google = { gmail, calendar, auth };
export default google;
