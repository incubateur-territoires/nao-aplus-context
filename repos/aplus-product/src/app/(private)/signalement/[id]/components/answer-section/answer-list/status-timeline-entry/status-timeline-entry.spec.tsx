import { render, screen } from "@testing-library/react";
import { StatusTimelineEntry } from "./status-timeline-entry";
import type { ReportStatusHistoryType } from "../types";
import { ReportStatus } from "@/generated/prisma/client";
import { USER_ROLES } from "@/test/mocks";

jest.mock("@/app/services/report/request.service", () => ({
  ReportService: {
    getLabelReport: jest.fn(() => "Traité"),
  },
}));

const mockStatus: ReportStatusHistoryType = {
  id: "status-1",
  status: ReportStatus.COMPLETED,
  createdAt: new Date("2024-01-01T10:00:00Z"),
  authorId: "author-1",
  answerId: null,
  author: {
    id: "author-1",
    phone: "0123456789",
    profession: "Developer",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    name: "John Doe",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: USER_ROLES.USER,
    isInactive: null,
    cguAcceptedAt: null,
    lastActivityAt: new Date(),
    inactivityWarningsSentAt: [],
    notificationFrequency: "EACH_SOLICITATION" as const,
    lastDigestSentAt: null,
    newsLetterAcceptedAt: null,
    internalSupportComment: null,
    deletedAt: null,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    notificationsViewedBefore: null,
  },
  reportId: "request-1",
};

describe("StatusTimelineEntry", () => {
  it("renders status display with correct props", () => {
    render(
      <StatusTimelineEntry status={mockStatus} userTimezone="Europe/Paris" />,
    );

    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2);
  });

  it("applies correct styling classes", () => {
    const { container } = render(
      <StatusTimelineEntry status={mockStatus} userTimezone="Europe/Paris" />,
    );

    const mainContainer = container.querySelector(
      ".w-full.flex.items-center.my-8",
    );
    expect(mainContainer).toBeInTheDocument();
  });
});
