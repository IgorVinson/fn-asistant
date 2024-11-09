import {loginToFieldNation} from "./utils/loginToFieldNation.js";

const page = await loginToFieldNation('https://app.fieldnation.com/')
const notifyButtons = await page.$$('.IconButton__3SE5w');
const notifyButton = notifyButtons[5];
await notifyButton.click();

// const allNotifications = await page.waitForXPath.("//span[text()='View All Notifications']");
// await allNotifications.click();