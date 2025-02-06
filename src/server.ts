// console.log('Whats up');
import express, { Request, Response } from 'express';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_FILE = 'session.json';
let browser: Browser | null = null;
let page: Page | null = null;
let shiftsData: Shift[] = [];

// Define shift type
interface Shift {
  time: string;
  description: string;
}

// 🔹 Initialize Puppeteer and Restore Session
async function initBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage();

  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await page.setCookie(...cookies);
    console.log('✅ Session restored from file');
  }
}

// 🔹 Login Function
async function login(): Promise<void> {
  if (!page) throw new Error('Browser is not initialized.');

  console.log('🔐 Logging into Food Coop...');
  await page.goto(
    'https://members.foodcoop.com/services/login/?next=/services/',
    {
      waitUntil: 'networkidle2',
    }
  );

  const username = process.env.FOODCOOP_USERNAME;
  const password = process.env.FOODCOOP_PASSWORD;

  if (!username || !password) throw new Error('❌ Missing credentials!');

  await page.type('#id_username', username);
  await page.type('#id_password', password);
  await Promise.all([page.click('#submit'), page.waitForNavigation()]);

  // Save session cookies
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies));
  console.log('✅ Login successful & session saved');
}

// 🔹 Scrape Available Shifts
async function scrapeShifts(): Promise<void> {
  if (!page) throw new Error('Browser is not initialized.');

  console.log('🔍 Scraping available shifts...');
  await page.goto('https://members.foodcoop.com/services/shifts', {
    waitUntil: 'domcontentloaded',
  });

  shiftsData = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a.shift')).map((shift) => ({
      time: shift.querySelector('b')?.textContent?.trim() || 'Unknown',
      description:
        shift.textContent
          ?.replace(shift.querySelector('b')?.textContent || '', '')
          .trim() || 'Unknown',
    }));
  });

  console.log('✅ Shifts scraped:', shiftsData);
}
console.log('Acraped Array', shiftsData);

// 🔹 Schedule Scraping Every 60 Seconds
async function startScraping() {
  await initBrowser();
  if (!fs.existsSync(SESSION_FILE)) {
    await login();
  }
  await scrapeShifts();
  setInterval(scrapeShifts, 60000);
}

// 🔹 API Endpoint to Get Scraped Shifts
app.get('/shifts', (req: Request, res: Response) => {
  res.json({ shifts: shiftsData });
});

// 🔹 Start the Server and Begin Scraping
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  await startScraping();
});
