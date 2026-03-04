import { getPage } from './browser';

export interface Shift {
  time: string;
  description: string;
  href: string; // The relative URL of the shift link e.g. "/services/shifts/signup/?id=12345"
}

export async function scrapeShifts(): Promise<Record<string, Shift[]>> {
  const page = getPage();
  if (!page) throw new Error('Browser not initialized');

  console.log('🔍 Scraping shifts...');
  await page.goto('https://members.foodcoop.com/services/shifts', {
    waitUntil: 'domcontentloaded',
  });

  let shiftsData: Record<string, Shift[]> = {};

  while (true) {
    console.log('🔍 Scraping shifts from:', page.url());

    const pageShifts = await page.evaluate(() => {
      const shiftsByDate: Record<
        string,
        { time: string; description: string; href: string }[]
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
            href: shift.getAttribute('href') || '', // ← Capture the signup link
          }),
        );

        if (shifts.length > 0) {
          shiftsByDate[date] = shifts;
        }
      });

      return shiftsByDate;
    });

    for (const [date, shifts] of Object.entries(pageShifts)) {
      if (!shiftsData[date]) shiftsData[date] = [];
      shiftsData[date].push(...shifts);
    }

    const nextWeekHref = await page.evaluate(() => {
      const nextWeekLink = Array.from(document.querySelectorAll('a')).find(
        (a) => a.textContent?.trim().startsWith('Next Week'),
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

  return shiftsData;
}
