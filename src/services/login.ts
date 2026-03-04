import { getScrapePage } from './browser';
import { config } from '../config';

export async function login(): Promise<void> {
  const page = getScrapePage();

  console.log('🔐 Logging in...');

  // Use domcontentloaded — networkidle2 can timeout on slow connections
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error(
      '❌ Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars',
    );
  }

  // Wait for the form fields to actually be present before typing
  await page.waitForSelector('#id_username', { timeout: 10000 });
  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);

  // Click submit and wait for navigation together
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.click('#submit'),
  ]);

  console.log('✅ Login successful');
}
