import {
  isBusinessDay,
  countBusinessDays,
  isOverdueByBusinessDays,
  isOverdueByCalendarDays,
  getOverdueBusinessDayCutoff,
  getOverdueCalendarDayCutoff,
  getEasterSunday,
  getFrenchHolidays,
  isFrenchHoliday,
} from "./business-days";

describe("business-days", () => {
  describe("getEasterSunday", () => {
    it("calculates Easter 2024 correctly", () => {
      const easter2024 = getEasterSunday(2024);
      expect(easter2024.getFullYear()).toBe(2024);
      expect(easter2024.getMonth()).toBe(2); // March (0-indexed)
      expect(easter2024.getDate()).toBe(31);
    });

    it("calculates Easter 2025 correctly", () => {
      const easter2025 = getEasterSunday(2025);
      expect(easter2025.getFullYear()).toBe(2025);
      expect(easter2025.getMonth()).toBe(3); // April (0-indexed)
      expect(easter2025.getDate()).toBe(20);
    });

    it("calculates Easter 2026 correctly", () => {
      const easter2026 = getEasterSunday(2026);
      expect(easter2026.getFullYear()).toBe(2026);
      expect(easter2026.getMonth()).toBe(3); // April
      expect(easter2026.getDate()).toBe(5);
    });
  });

  describe("getFrenchHolidays", () => {
    it("returns 11 holidays for a year", () => {
      const holidays = getFrenchHolidays(2024);
      expect(holidays).toHaveLength(11);
    });

    it("includes fixed holidays for 2024", () => {
      const holidays = getFrenchHolidays(2024);
      const holidayStrings = holidays.map(
        (d) => `${d.getMonth() + 1}-${d.getDate()}`,
      );

      // Fixed holidays (month-day)
      expect(holidayStrings).toContain("1-1"); // Jour de l'An
      expect(holidayStrings).toContain("5-1"); // Fête du Travail
      expect(holidayStrings).toContain("5-8"); // Victoire 1945
      expect(holidayStrings).toContain("7-14"); // Fête Nationale
      expect(holidayStrings).toContain("8-15"); // Assomption
      expect(holidayStrings).toContain("11-1"); // Toussaint
      expect(holidayStrings).toContain("11-11"); // Armistice
      expect(holidayStrings).toContain("12-25"); // Noël
    });

    it("includes moveable holidays for 2024", () => {
      const holidays = getFrenchHolidays(2024);
      const holidayStrings = holidays.map(
        (d) => `${d.getMonth() + 1}-${d.getDate()}`,
      );

      // Easter 2024 is March 31
      expect(holidayStrings).toContain("4-1"); // Lundi de Pâques (April 1)
      expect(holidayStrings).toContain("5-9"); // Ascension (May 9)
      expect(holidayStrings).toContain("5-20"); // Lundi de Pentecôte (May 20)
    });

    it("calculates moveable holidays correctly for 2025", () => {
      const holidays = getFrenchHolidays(2025);
      const holidayStrings = holidays.map(
        (d) => `${d.getMonth() + 1}-${d.getDate()}`,
      );

      // Easter 2025 is April 20
      expect(holidayStrings).toContain("4-21"); // Lundi de Pâques
      expect(holidayStrings).toContain("5-29"); // Ascension
      expect(holidayStrings).toContain("6-9"); // Lundi de Pentecôte
    });
  });

  describe("isFrenchHoliday", () => {
    it("returns true for Christmas", () => {
      expect(isFrenchHoliday(new Date(2024, 11, 25))).toBe(true);
    });

    it("returns true for New Year", () => {
      expect(isFrenchHoliday(new Date(2024, 0, 1))).toBe(true);
    });

    it("returns true for Labour Day", () => {
      expect(isFrenchHoliday(new Date(2024, 4, 1))).toBe(true);
    });

    it("returns true for Easter Monday 2024", () => {
      expect(isFrenchHoliday(new Date(2024, 3, 1))).toBe(true);
    });

    it("returns false for regular day", () => {
      expect(isFrenchHoliday(new Date(2024, 5, 15))).toBe(false);
    });

    it("returns false for weekend days that are not holidays", () => {
      // June 15, 2024 is a Saturday
      expect(isFrenchHoliday(new Date(2024, 5, 15))).toBe(false);
    });
  });

  describe("isBusinessDay", () => {
    it("returns true for a regular Monday", () => {
      // December 2, 2024 is a Monday
      expect(isBusinessDay(new Date(2024, 11, 2))).toBe(true);
    });

    it("returns false for Saturday", () => {
      // November 30, 2024 is a Saturday
      expect(isBusinessDay(new Date(2024, 10, 30))).toBe(false);
    });

    it("returns false for Sunday", () => {
      // December 1, 2024 is a Sunday
      expect(isBusinessDay(new Date(2024, 11, 1))).toBe(false);
    });

    it("returns false for Christmas", () => {
      expect(isBusinessDay(new Date(2024, 11, 25))).toBe(false);
    });

    it("returns false for Labour Day", () => {
      expect(isBusinessDay(new Date(2024, 4, 1))).toBe(false);
    });

    it("returns false for July 14 (Bastille Day)", () => {
      expect(isBusinessDay(new Date(2024, 6, 14))).toBe(false);
    });
  });

  describe("countBusinessDays", () => {
    it("returns 0 when start equals end", () => {
      const date = new Date(2024, 11, 2);
      expect(countBusinessDays(date, date)).toBe(0);
    });

    it("returns 0 when start is after end", () => {
      const start = new Date(2024, 11, 5);
      const end = new Date(2024, 11, 2);
      expect(countBusinessDays(start, end)).toBe(0);
    });

    it("counts 5 business days in a regular week (Mon-Fri)", () => {
      // Monday Dec 2 to Monday Dec 9 (exclusive)
      const start = new Date(2024, 11, 2);
      const end = new Date(2024, 11, 9);
      expect(countBusinessDays(start, end)).toBe(5);
    });

    it("counts 0 business days for weekend only", () => {
      // Saturday Nov 30 to Monday Dec 2
      const start = new Date(2024, 10, 30);
      const end = new Date(2024, 11, 2);
      expect(countBusinessDays(start, end)).toBe(0);
    });

    it("excludes holidays from count", () => {
      // Christmas week 2024: Dec 23 (Mon) to Dec 30 (Mon)
      // Dec 25 is Christmas, so only 4 business days
      const start = new Date(2024, 11, 23);
      const end = new Date(2024, 11, 30);
      expect(countBusinessDays(start, end)).toBe(4);
    });

    it("counts correctly across a month with Labour Day", () => {
      // April 28 to May 3 (2024)
      // April 28 is Sunday, April 29-30 are Mon-Tue
      // May 1 is holiday, May 2 is Thu
      const start = new Date(2024, 3, 28);
      const end = new Date(2024, 4, 3);
      // Business days: Apr 29, Apr 30, May 2 = 3
      expect(countBusinessDays(start, end)).toBe(3);
    });
  });

  describe("isOverdueByBusinessDays", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns false when within threshold", () => {
      // Current date: Monday Dec 2, 2024
      jest.setSystemTime(new Date(2024, 11, 2, 10, 0, 0));
      // Date from: Friday Nov 29, 2024 (1 business day ago)
      const date = new Date(2024, 10, 29);
      expect(isOverdueByBusinessDays(date, 3)).toBe(false);
    });

    it("returns true when exceeding threshold", () => {
      // Current date: Monday Dec 9, 2024
      jest.setSystemTime(new Date(2024, 11, 9, 10, 0, 0));
      // Date from: Monday Dec 2, 2024 (5 business days ago)
      const date = new Date(2024, 11, 2);
      expect(isOverdueByBusinessDays(date, 3)).toBe(true);
    });

    it("returns false when exactly at threshold", () => {
      // Current date: Thursday Dec 5, 2024
      jest.setSystemTime(new Date(2024, 11, 5, 10, 0, 0));
      // Date from: Monday Dec 2, 2024
      // Business days between Dec 2 and Dec 5 (exclusive): Dec 2, 3, 4 = 3 days
      const date = new Date(2024, 11, 2);
      expect(isOverdueByBusinessDays(date, 3)).toBe(false);
      expect(isOverdueByBusinessDays(date, 2)).toBe(true);
    });

    it("handles weekend correctly", () => {
      // Current date: Monday Dec 9, 2024
      jest.setSystemTime(new Date(2024, 11, 9, 10, 0, 0));
      // Date from: Wednesday Dec 4, 2024
      // Business days between Dec 4 and Dec 9 (exclusive): Dec 4 (Wed), Dec 5 (Thu), Dec 6 (Fri) = 3 days
      // Weekend (Dec 7-8) not counted
      const date = new Date(2024, 11, 4);
      expect(isOverdueByBusinessDays(date, 3)).toBe(false);
      expect(isOverdueByBusinessDays(date, 2)).toBe(true);
    });
  });

  describe("isOverdueByCalendarDays", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns false when within threshold", () => {
      jest.setSystemTime(new Date(2024, 11, 5, 10, 0, 0));
      const date = new Date(2024, 11, 1);
      expect(isOverdueByCalendarDays(date, 15)).toBe(false);
    });

    it("returns true when exceeding threshold", () => {
      jest.setSystemTime(new Date(2024, 11, 20, 10, 0, 0));
      const date = new Date(2024, 11, 1);
      expect(isOverdueByCalendarDays(date, 15)).toBe(true);
    });

    it("returns false when exactly at threshold", () => {
      jest.setSystemTime(new Date(2024, 11, 16, 10, 0, 0));
      const date = new Date(2024, 11, 1);
      expect(isOverdueByCalendarDays(date, 15)).toBe(false);
    });

    it("counts weekends as calendar days", () => {
      jest.setSystemTime(new Date(2024, 11, 9, 10, 0, 0));
      // From Dec 2 to Dec 9 = 7 calendar days
      const date = new Date(2024, 11, 2);
      expect(isOverdueByCalendarDays(date, 6)).toBe(true);
      expect(isOverdueByCalendarDays(date, 7)).toBe(false);
    });
  });

  describe("getOverdueBusinessDayCutoff", () => {
    it("returns Apr 15 2026 for threshold=3 on Monday Apr 20 2026", () => {
      // Easter Monday (Apr 6) is a holiday, so 3 BDs back from Apr 20 walks:
      // Apr 19 Sun, 18 Sat, 17 Fri(1), 16 Thu(2), 15 Wed(3), 14 Tue(4 > 3)
      // cutoff = Apr 14 + 1 day = Apr 15 00:00
      const now = new Date(2026, 3, 20, 9, 0, 0);
      const cutoff = getOverdueBusinessDayCutoff(now, 3);
      expect(cutoff.getFullYear()).toBe(2026);
      expect(cutoff.getMonth()).toBe(3);
      expect(cutoff.getDate()).toBe(15);
      expect(cutoff.getHours()).toBe(0);
    });

    it("is consistent with isOverdueByBusinessDays (boundary check)", () => {
      jest.useFakeTimers();
      const now = new Date(2026, 3, 20, 9, 0, 0);
      jest.setSystemTime(now);

      const cutoff = getOverdueBusinessDayCutoff(now, 3);
      // Any date strictly before the cutoff must be overdue, the cutoff itself must not
      const justBefore = new Date(cutoff.getTime() - 1);
      const atCutoff = cutoff;
      expect(isOverdueByBusinessDays(justBefore, 3)).toBe(true);
      expect(isOverdueByBusinessDays(atCutoff, 3)).toBe(false);

      jest.useRealTimers();
    });

    it("skips weekends when walking back", () => {
      // Wednesday Dec 4 2024, threshold=2: walk back Dec 3 Tue(1), Dec 2 Mon(2), Dec 1 Sun skip, Nov 30 Sat skip, Nov 29 Fri(3 > 2)
      // cutoff = Nov 29 + 1 = Nov 30
      const now = new Date(2024, 11, 4, 12, 0, 0);
      const cutoff = getOverdueBusinessDayCutoff(now, 2);
      expect(cutoff.getMonth()).toBe(10);
      expect(cutoff.getDate()).toBe(30);
    });

    it("skips Easter Monday (2026-04-06) when walking back from Apr 13 2026", () => {
      // Apr 13 Mon, threshold=3: walk back
      // Apr 12 Sun skip, Apr 11 Sat skip, Apr 10 Fri(1), Apr 9 Thu(2), Apr 8 Wed(3), Apr 7 Tue(4 > 3)
      // Easter Monday Apr 6 is not touched yet, cutoff = Apr 7 + 1 = Apr 8
      const now = new Date(2026, 3, 13, 9, 0, 0);
      const cutoff = getOverdueBusinessDayCutoff(now, 3);
      expect(cutoff.getMonth()).toBe(3);
      expect(cutoff.getDate()).toBe(8);
    });

    it("skips Easter Monday when the walk-back traverses it", () => {
      // Threshold=5 from Tue Apr 7 2026: walk back
      // Apr 6 Mon (holiday, skip), Apr 5 Sun skip, Apr 4 Sat skip, Apr 3 Fri(1), Apr 2 Thu(2), Apr 1 Wed(3), Mar 31 Tue(4), Mar 30 Mon(5), Mar 29 Sun skip, Mar 28 Sat skip, Mar 27 Fri(6 > 5)
      // cutoff = Mar 27 + 1 = Mar 28
      const now = new Date(2026, 3, 7, 9, 0, 0);
      const cutoff = getOverdueBusinessDayCutoff(now, 5);
      expect(cutoff.getMonth()).toBe(2);
      expect(cutoff.getDate()).toBe(28);
    });
  });

  describe("getOverdueCalendarDayCutoff", () => {
    it("returns now - threshold days at start of day", () => {
      const now = new Date(2026, 3, 20, 15, 30, 0);
      const cutoff = getOverdueCalendarDayCutoff(now, 15);
      expect(cutoff.getFullYear()).toBe(2026);
      expect(cutoff.getMonth()).toBe(3);
      expect(cutoff.getDate()).toBe(5);
      expect(cutoff.getHours()).toBe(0);
    });

    it("is consistent with isOverdueByCalendarDays (boundary check)", () => {
      jest.useFakeTimers();
      const now = new Date(2026, 3, 20, 9, 0, 0);
      jest.setSystemTime(now);

      const cutoff = getOverdueCalendarDayCutoff(now, 15);
      const justBefore = new Date(cutoff.getTime() - 1);
      expect(isOverdueByCalendarDays(justBefore, 15)).toBe(true);
      expect(isOverdueByCalendarDays(cutoff, 15)).toBe(false);

      jest.useRealTimers();
    });
  });
});
