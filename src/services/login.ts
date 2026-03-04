import { getScrapePage } from './browser';
import { config } from '../config';

export async function login(): Promise<void> {
  const page = getScrapePage();

  console.log('🔐 Logging in...');
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'networkidle2',
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error(
      '❌ Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars',
    );
  }

  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);
  await Promise.all([page.click('#submit'), page.waitForNavigation()]);

  console.log('✅ Login successful');
}
