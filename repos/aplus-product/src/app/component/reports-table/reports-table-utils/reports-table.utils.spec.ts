import { formatDate, getLastMessageDate } from "./reports-table.utils";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";
import { createMockReport, createMockAnswer } from "@/test/mocks";

type Report =
  inferRouterOutputs<AppRouter>["report"]["getMyCreatedReportsTable"]["reports"][number];

describe("reports-table.utils", () => {
  describe("formatDate", () => {
    it("formats Date object to French format", () => {
      const date = new Date("2024-01-15");
      const result = formatDate(date);
      expect(result).toBe("15 janv. 2024");
    });

    it("formats date string to French format", () => {
      const dateString = "2024-06-24";
      const result = formatDate(dateString);
      expect(result).toBe("24 juin 2024");
    });

    it("handles different months correctly", () => {
      const date = new Date("2024-12-25");
      const result = formatDate(date);
      expect(result).toBe("25 déc. 2024");
    });
  });

  describe("getLastMessageDate", () => {
    it("returns createdAt from latest answer when answers exist", () => {
      const report = createMockReport({
        updatedAt: new Date("2024-01-05"),
        answers: [
          createMockAnswer({ createdAt: new Date("2024-01-03") }),
          createMockAnswer({
            id: "answer-2",
            createdAt: new Date("2024-01-02"),
          }),
        ],
      }) as unknown as Report;

      const result = getLastMessageDate(report);
      expect(result).toEqual(new Date("2024-01-03"));
    });

    it("returns updatedAt when no answers exist", () => {
      const report = createMockReport({
        updatedAt: new Date("2024-01-05"),
      }) as unknown as Report;

      const result = getLastMessageDate(report);
      expect(result).toEqual(new Date("2024-01-05"));
    });

    it("returns null when answers array is empty and updatedAt is null", () => {
      const report = createMockReport({
        updatedAt: null as unknown as Date,
      }) as unknown as Report;

      const result = getLastMessageDate(report);
      expect(result).toBeNull();
    });

    it("handles answers with null createdAt", () => {
      const report = createMockReport({
        answers: [createMockAnswer({ createdAt: null as unknown as Date })],
      }) as unknown as Report;

      const result = getLastMessageDate(report);
      expect(result).toBeNull();
    });
  });
});
