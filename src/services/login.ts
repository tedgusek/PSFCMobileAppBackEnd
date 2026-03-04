import { getScrapePage, getSignupPage } from './browser';
import { config } from '../config';

async function loginOnPage(page: any, label: string): Promise<void> {
  console.log(`🔐 Logging in (${label})...`);

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error('Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars');
  }

  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'networkidle2',
  });

  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('#submit'),
  ]);

  console.log(`✅ Login successful (${label})`);
}

export async function login(): Promise<void> {
  await loginOnPage(getScrapePage(), 'scrape page');
}

export async function loginSignupPage(): Promise<void> {
  await loginOnPage(getSignupPage(), 'signup page');
}
