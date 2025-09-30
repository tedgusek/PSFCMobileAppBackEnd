// cache.ts
let cachedShiftsData: Record<string, { time: string; description: string }[]> =
  {};

export function getCachedShifts() {
  return cachedShiftsData;
}

export function setCachedShifts(data: typeof cachedShiftsData) {
  cachedShiftsData = data;
}
