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

export async function scrapeShifts() {
  const page = getPage();
  if (!page) throw new Error('Browser not initialized');

  console.log('🔍 Scraping shifts...');
  await page.goto('https://members.foodcoop.com/services/shifts', {
    waitUntil: 'domcontentloaded',
  });

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

  // console.log('✅ All shifts scraped:', shiftsData);
  return shiftsData;
}
