import fs from 'fs';
import { getPage } from './browser';
import { config } from '../config';

export async function login() {
  const page = getPage();
  if (!page) throw new Error('Browser not initialized');

  console.log('🔐 Logging in...');
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'networkidle2',
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD)
    throw new Error('❌ Missing credentials');

  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);
  await Promise.all([page.click('#submit'), page.waitForNavigation()]);

  const cookies = await page.cookies();
  fs.writeFileSync(config.SESSION_FILE, JSON.stringify(cookies));
  console.log('✅ Login successful & session saved');
  // scrapeShifts();
}
