import 'dotenv/config';
import { appendRejectedTicket } from './utils/notion/rejectedTickets.js';
async function test() {
  try {
    await appendRejectedTicket('<b>TEST</b> Ticket sorting order');
    console.log('Success!');
  } catch (e) {
    console.error('Failed!', e);
  }
}
test();
