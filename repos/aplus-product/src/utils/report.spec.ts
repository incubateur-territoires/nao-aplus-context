import { findMostActiveTeamMember } from "./report";
import type { PrismaClient } from "@/generated/prisma/client";

interface GroupByRow {
  authorId: string;
  _count: { _all: number };
  _max: { createdAt: Date | null };
}

function createMockPrisma(groupByRows: GroupByRow[]) {
  const groupBy = jest.fn().mockResolvedValue(groupByRows);
  return {
    prisma: { answer: { groupBy } } as unknown as PrismaClient,
    groupBy,
  };
}

function row(
  authorId: string,
  count: number,
  createdAt: Date | null,
): GroupByRow {
  return { authorId, _count: { _all: count }, _max: { createdAt } };
}

describe("findMostActiveTeamMember", () => {
  it("throws when no member is provided", async () => {
    const { prisma } = createMockPrisma([]);
    await expect(findMostActiveTeamMember([], prisma)).rejects.toThrow(
      "No team members provided",
    );
  });

  it("returns the single member without querying answers", async () => {
    const { prisma, groupBy } = createMockPrisma([]);
    await expect(findMostActiveTeamMember(["solo"], prisma)).resolves.toBe(
      "solo",
    );
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("returns the member with the most answers", async () => {
    const { prisma } = createMockPrisma([
      row("member-a", 2, new Date("2026-01-10")),
      row("member-b", 5, new Date("2026-01-05")),
    ]);
    await expect(
      findMostActiveTeamMember(["member-a", "member-b"], prisma),
    ).resolves.toBe("member-b");
  });

  it("breaks ties on answer count by most recent answer", async () => {
    const { prisma } = createMockPrisma([
      row("member-a", 3, new Date("2026-01-01")),
      row("member-b", 3, new Date("2026-03-01")),
    ]);
    await expect(
      findMostActiveTeamMember(["member-a", "member-b"], prisma),
    ).resolves.toBe("member-b");
  });

  it("falls back to the first member when nobody has answered", async () => {
    const { prisma } = createMockPrisma([]);
    await expect(
      findMostActiveTeamMember(["member-a", "member-b"], prisma),
    ).resolves.toBe("member-a");
  });

  it("counts answers grouped by author across the given members", async () => {
    const { prisma, groupBy } = createMockPrisma([
      row("member-a", 1, new Date("2026-02-01")),
    ]);
    await findMostActiveTeamMember(["member-a", "member-b"], prisma);
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["authorId"],
        where: { authorId: { in: ["member-a", "member-b"] } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    );
  });
});
