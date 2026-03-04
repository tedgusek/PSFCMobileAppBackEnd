import { getPage } from './browser';

export interface Shift {
  time: string;
  description: string;
  href: string;
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
            // Clean up description — strip emojis artifacts, extra whitespace
            description: (shift.textContent || '')
              .replace(shift.querySelector('b')?.textContent || '', '')
              .replace(/\s+/g, ' ')
              .trim(),
            // Trim whitespace from href — the site has leading/trailing spaces
            href: (shift.getAttribute('href') || '').trim(),
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

    // Check for a "Next Week" navigation link
    const nextWeekHref = await page.evaluate(() => {
      const nextWeekLink = Array.from(document.querySelectorAll('a')).find(
        (a) => a.textContent?.trim().startsWith('Next Week'),
      );
      return nextWeekLink
        ? (nextWeekLink.getAttribute('href') || '').trim()
        : null;
    });

    if (nextWeekHref) {
      console.log(`➡️ Moving to next week: ${nextWeekHref}`);
      await page.goto(`https://members.foodcoop.com${nextWeekHref}`, {
        waitUntil: 'domcontentloaded',
      });
    } else {
      console.log('✅ No more pages to scrape.');
      break;
    }
  }

  // Sort dates chronologically before returning
  // Date strings from the site look like "Thu 3/5/2026"
  const sorted: Record<string, Shift[]> = {};
  const sortedKeys = Object.keys(shiftsData).sort((a, b) => {
    const parseDate = (d: string) => {
      // Strip the day-of-week prefix e.g. "Thu " → "3/5/2026"
      const datePart = d.replace(/^[A-Za-z]+\s+/, '');
      return new Date(datePart).getTime();
    };
    return parseDate(a) - parseDate(b);
  });

  for (const key of sortedKeys) {
    sorted[key] = shiftsData[key];
  }

  return sorted;
}
