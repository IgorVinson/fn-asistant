import { postWMCounterOffer } from './postWMCounterOffer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  try {
    // Check if cookies file exists and print its contents
    const cookiesPath = path.join(__dirname, 'cookies.json');
    console.log('Looking for cookies at:', cookiesPath);

    if (fs.existsSync(cookiesPath)) {
      const cookiesContent = fs.readFileSync(cookiesPath, 'utf-8');
    } else {
      console.log('Cookies file not found at:', cookiesPath);
    }

    // Test parameters
    const workOrderId = '9077905739';
    const hourlyRate = 50;
    const hours = 4;
    const distance = 70;

    console.log('Attempting to send counter offer with params:', {
      workOrderId,
      hourlyRate,
      hours,
      distance,
    });

    const result = await postWMCounterOffer(
      workOrderId,
      hourlyRate,
      hours,
      distance
    );

    console.log('Counter offer result:', result);
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

test();
