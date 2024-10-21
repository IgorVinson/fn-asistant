import {authorize} from "./auth.js";
import {listUnreadEmailsFromFieldNation} from "./listUnreadEmails.js";
import {getLastUnreadEmail} from "./getLastUnreadEmail.js";

// Запускаємо авторизацію і виклик функції для виведення заголовків листів
authorize().then(getLastUnreadEmail).catch(console.error);
