import {
  getActivityLabel,
  getActivityLabels,
  getLastActivityDate,
} from "./team-content.utils";
import { MOCK_DATES } from "@/test/mocks";

describe("team-content.utils", () => {
  describe("getActivityLabel", () => {
    it("returns 'Aucune activité' when totalReports is 0", () => {
      const result = getActivityLabel(0);
      expect(result).toBe("Aucune activité");
    });

    it("returns '1 signalement' when totalReports is 1", () => {
      const result = getActivityLabel(1);
      expect(result).toBe("1 signalement");
    });

    it("returns formatted string with count when totalReports is greater than 1", () => {
      const result = getActivityLabel(5);
      expect(result).toBe("5 signalements");
    });

    it("handles large numbers correctly", () => {
      const result = getActivityLabel(100);
      expect(result).toBe("100 signalements");
    });
  });

  describe("getLastActivityDate", () => {
    it("returns null when dates array is empty", () => {
      const result = getLastActivityDate([]);
      expect(result).toBeNull();
    });

    it("returns the date when there is a single date", () => {
      const date = MOCK_DATES.JAN_1_2024;
      const result = getLastActivityDate([date]);
      expect(result).toEqual(date);
    });

    it("returns the most recent date when multiple dates are provided", () => {
      const dates = [
        MOCK_DATES.JAN_1_2024,
        MOCK_DATES.JAN_3_2024,
        MOCK_DATES.JAN_2_2024,
      ];
      const result = getLastActivityDate(dates);
      expect(result).toEqual(MOCK_DATES.JAN_3_2024);
    });

    it("handles dates in chronological order", () => {
      const dates = [
        MOCK_DATES.JAN_1_2024,
        MOCK_DATES.JAN_2_2024,
        MOCK_DATES.JAN_3_2024,
      ];
      const result = getLastActivityDate(dates);
      expect(result).toEqual(MOCK_DATES.JAN_3_2024);
    });

    it("handles dates in reverse chronological order", () => {
      const dates = [
        MOCK_DATES.JAN_3_2024,
        MOCK_DATES.JAN_2_2024,
        MOCK_DATES.JAN_1_2024,
      ];
      const result = getLastActivityDate(dates);
      expect(result).toEqual(MOCK_DATES.JAN_3_2024);
    });

    it("handles dates with same timestamp", () => {
      const date = MOCK_DATES.JAN_1_2024;
      const dates = [date, date, date];
      const result = getLastActivityDate(dates);
      expect(result).toEqual(date);
    });
  });

  describe("getActivityLabels", () => {
    it("returns empty array when metrics is undefined", () => {
      const result = getActivityLabels(undefined);
      expect(result).toEqual([]);
    });

    it("returns empty array when all metrics are 0", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 0,
        participations: 0,
      });
      expect(result).toEqual([]);
    });

    it("returns singular form for signalements when count is 1", () => {
      const result = getActivityLabels({
        signalements: 1,
        sollicitations: 0,
        participations: 0,
      });
      expect(result).toContain("1 signalement");
    });

    it("returns plural form for signalements when count is > 1", () => {
      const result = getActivityLabels({
        signalements: 5,
        sollicitations: 0,
        participations: 0,
      });
      expect(result).toContain("5 signalements");
    });

    it("does not show signalements label when count is 0", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 1,
        participations: 0,
      });
      expect(result.some((l) => l.includes("signalement"))).toBe(false);
    });

    it("returns singular form for sollicitations when count is 1", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 1,
        participations: 0,
      });
      expect(result).toContain("1 sollicitation");
    });

    it("returns plural form for sollicitations when count is > 1", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 3,
        participations: 0,
      });
      expect(result).toContain("3 sollicitations");
    });

    it("does not show sollicitations label when count is 0", () => {
      const result = getActivityLabels({
        signalements: 1,
        sollicitations: 0,
        participations: 1,
      });
      expect(result.some((l) => l.includes("sollicitation"))).toBe(false);
    });

    it("returns singular form for participations when count is 1", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 0,
        participations: 1,
      });
      expect(result).toContain("1 participation");
    });

    it("returns plural form for participations when count is > 1", () => {
      const result = getActivityLabels({
        signalements: 0,
        sollicitations: 0,
        participations: 2,
      });
      expect(result).toContain("2 participations");
    });

    it("does not show participations label when count is 0", () => {
      const result = getActivityLabels({
        signalements: 1,
        sollicitations: 0,
        participations: 0,
      });
      expect(result.some((l) => l.includes("participation"))).toBe(false);
    });

    it("returns all three labels when all metrics are > 0", () => {
      const result = getActivityLabels({
        signalements: 1,
        sollicitations: 2,
        participations: 3,
      });
      expect(result).toHaveLength(3);
      expect(result).toContain("1 signalement");
      expect(result).toContain("2 sollicitations");
      expect(result).toContain("3 participations");
    });
  });
});
