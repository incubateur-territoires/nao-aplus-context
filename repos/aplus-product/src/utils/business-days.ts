import {
  isWeekend,
  differenceInCalendarDays,
  eachDayOfInterval,
  getYear,
  addDays,
} from "date-fns";

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Returns all French public holidays for a given year
 * Includes fixed holidays and moveable ones based on Easter
 */
function getFrenchHolidays(year: number): Date[] {
  const easter = getEasterSunday(year);

  // Fixed holidays
  const fixedHolidays = [
    new Date(year, 0, 1), // Jour de l'An
    new Date(year, 4, 1), // Fête du Travail
    new Date(year, 4, 8), // Victoire 1945
    new Date(year, 6, 14), // Fête Nationale
    new Date(year, 7, 15), // Assomption
    new Date(year, 10, 1), // Toussaint
    new Date(year, 10, 11), // Armistice
    new Date(year, 11, 25), // Noël
  ];

  // Moveable holidays based on Easter
  const moveableHolidays = [
    addDays(easter, 1), // Lundi de Pâques (Easter Monday)
    addDays(easter, 39), // Ascension (39 days after Easter)
    addDays(easter, 50), // Lundi de Pentecôte (Whit Monday)
  ];

  return [...fixedHolidays, ...moveableHolidays];
}

/**
 * Checks if a date is a French public holiday
 */
function isFrenchHoliday(date: Date): boolean {
  const year = getYear(date);
  const holidays = getFrenchHolidays(year);

  return holidays.some(
    (holiday) =>
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate(),
  );
}

/**
 * Checks if a date is a business day (not weekend, not French holiday)
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isFrenchHoliday(date);
}

/**
 * Counts the number of business days between two dates (exclusive of end date)
 */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  if (startDate >= endDate) return 0;

  // Normalize to start of day for accurate day comparison
  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );

  // Exclusive of end date: go up to day before end
  const dayBeforeEnd = new Date(end);
  dayBeforeEnd.setDate(dayBeforeEnd.getDate() - 1);

  if (start > dayBeforeEnd) return 0;

  const days = eachDayOfInterval({
    start,
    end: dayBeforeEnd,
  });

  return days.filter((day) => isBusinessDay(day)).length;
}

/**
 * Checks if a date is more than N business days ago
 * @param date The date to check
 * @param businessDays Number of business days threshold
 * @returns true if the date is more than businessDays business days ago
 */
export function isOverdueByBusinessDays(
  date: Date,
  businessDays: number,
): boolean {
  const now = new Date();
  const elapsed = countBusinessDays(date, now);
  return elapsed > businessDays;
}

/**
 * Checks if a date is more than N calendar days ago
 * @param date The date to check
 * @param days Number of calendar days threshold
 * @returns true if the date is more than days calendar days ago
 */
export function isOverdueByCalendarDays(date: Date, days: number): boolean {
  const now = new Date();
  const elapsed = differenceInCalendarDays(now, date);
  return elapsed > days;
}

/**
 * Returns the cutoff date such that `createdAt < cutoff` is strictly
 * equivalent to `isOverdueByBusinessDays(createdAt, threshold)` when evaluated
 * at the same `now`. Intended for SQL filtering via Prisma to avoid loading
 * the full set of active reports into memory.
 */
export function getOverdueBusinessDayCutoff(
  now: Date,
  threshold: number,
): Date {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let skipped = 0;
  while (skipped <= threshold) {
    cursor.setDate(cursor.getDate() - 1);
    if (isBusinessDay(cursor)) skipped++;
  }
  const cutoff = new Date(cursor);
  cutoff.setDate(cutoff.getDate() + 1);
  return cutoff;
}

/**
 * Returns the cutoff date such that `date < cutoff` is strictly equivalent to
 * `isOverdueByCalendarDays(date, threshold)` when evaluated at the same `now`.
 */
export function getOverdueCalendarDayCutoff(
  now: Date,
  threshold: number,
): Date {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoff.setDate(cutoff.getDate() - threshold);
  return cutoff;
}

// Export for testing
export { getFrenchHolidays, getEasterSunday, isFrenchHoliday };
