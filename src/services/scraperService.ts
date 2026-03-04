import { getScrapePage, isSignupInProgress } from './browser';

export interface Shift {
  time: string;
  description: string;
  href: string;
}

export async function scrapeShifts(): Promise<Record<string, Shift[]>> {
  // Don't scrape while a signup is in progress — it uses a different page
  // but we still want to avoid a noisy diff right after a signup completes
  if (isSignupInProgress()) {
    console.log('⏸️  Scrape skipped — signup in progress');
    throw new Error('SIGNUP_IN_PROGRESS');
  }

  const page = getScrapePage();

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
            description: (shift.textContent || '')
              .replace(shift.querySelector('b')?.textContent || '', '')
              .replace(/\s+/g, ' ')
              .trim(),
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

  // Sort dates chronologically
  const sorted: Record<string, Shift[]> = {};
  const sortedKeys = Object.keys(shiftsData).sort((a, b) => {
    const parseDate = (d: string) => {
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
