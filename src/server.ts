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

  // if (fs.existsSync(SESSION_FILE)) {
  //   const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
  //   await page.setCookie(...cookies);
  //   console.log('✅ Session restored from file');
  // }
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

  // Check if we got logged out
  if ((await page.title()) === 'Login - Food Coop') {
    console.log('⚠️ Session expired, re-logging in...');
    await login(); // Re-login if redirected to login page
    await scrapeShifts(); // Retry scraping after login
    return;
  }

  // shiftsData = await page.evaluate(() => {
  //   return Array.from(document.querySelectorAll('a.shift')).map((shift) => ({
  //     time: shift.querySelector('b')?.textContent?.trim() || 'Unknown',
  //     description:
  //       shift.textContent
  //         ?.replace(shift.querySelector('b')?.textContent || '', '')
  //         .trim() || 'Unknown',
  //   }));
  // });

  // shiftsData = await page.evaluate(() => {
  //   return Array.from(document.querySelectorAll('.col')).flatMap((col) => {
  //     const date =
  //       col.querySelector('b')?.textContent?.trim() || 'Unknown Date';

  //     return Array.from(col.querySelectorAll('a.shift')).map((shift) => ({
  //       date, // Attach the extracted date
  //       time: shift.querySelector('b')?.textContent?.trim() || 'Unknown',
  //       description:
  //         shift.textContent
  //           ?.replace(shift.querySelector('b')?.textContent || '', '')
  //           .trim() || 'Unknown',
  //     }));
  //   });
  // });

  let shiftsData: Record<string, { time: string; description: string }[]> = {}; // Store shifts by date

  while (true) {
    console.log('🔍 Scraping shifts from:', page.url());

    // Extract shifts grouped by date
    const pageShifts = await page.evaluate(() => {
      const shiftsByDate: Record<
        string,
        { time: string; description: string }[]
      > = {};

      document.querySelectorAll('.col').forEach((col) => {
        const date =
          col.querySelector('b')?.textContent?.trim() || 'Unknown Date';

        const shifts = Array.from(col.querySelectorAll('a.shift')).map(
          (shift) => ({
            time: shift.querySelector('b')?.textContent?.trim() || 'Unknown',
            description:
              shift.textContent
                ?.replace(shift.querySelector('b')?.textContent || '', '')
                .trim() || 'Unknown',
          })
        );

        if (shifts.length > 0) {
          shiftsByDate[date] = shifts;
        }
      });

      return shiftsByDate;
    });

    // Merge page shifts into main shiftsData
    for (const [date, shifts] of Object.entries(pageShifts)) {
      if (!shiftsData[date]) {
        shiftsData[date] = [];
      }
      shiftsData[date].push(...shifts);
    }

    // Check if there's a "Next Week" link
    const nextWeekHref = await page.evaluate(() => {
      const nextWeekLink = Array.from(document.querySelectorAll('a')).find(
        (a) => a.textContent?.trim().startsWith('Next Week')
      );
      return nextWeekLink ? nextWeekLink.getAttribute('href') : null;
    });

    if (nextWeekHref) {
      console.log(`➡️ Moving to the next page: ${nextWeekHref}`);
      await page.goto(`https://members.foodcoop.com${nextWeekHref}`, {
        waitUntil: 'domcontentloaded',
      });
    } else {
      console.log('✅ No more pages to scrape.');
      break;
    }
  }

  console.log('✅ All shifts scraped:', shiftsData);
}

// 🔹 Schedule Scraping Every 60 Seconds
async function startScraping() {
  await initBrowser();
  await login();
  if (!fs.existsSync(SESSION_FILE)) {
    await login();
  }
  await scrapeShifts();
  // setInterval(scrapeShifts, 60000);
  // setInterval(scrapeShifts, 5000);
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
