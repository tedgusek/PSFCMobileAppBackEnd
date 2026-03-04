import { Shift } from './scraperService';

let cachedShiftsData: Record<string, Shift[]> = {};

export function getCachedShifts(): Record<string, Shift[]> {
  return cachedShiftsData;
}

export function setCachedShifts(data: Record<string, Shift[]>): void {
  cachedShiftsData = data;
}
