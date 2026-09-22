export const mockTRPC = {
  area: {
    getActiveAreas: {
      queryOptions: () => ({ queryKey: ["area"] }),
    },
  },
  team: {
    getActiveTeamsByAreaIds: {
      queryOptions: () => ({ queryKey: ["team"] }),
    },
  },
  user: {
    getUsers: {
      queryOptions: () => ({ queryKey: ["user"] }),
    },
    getCurrentUser: {
      queryOptions: () => ({ queryKey: ["user", "random"] }),
    },
  },
  request: {
    createRequest: {
      mutationOptions: () => ({ mutationKey: ["request", "create"] }),
    },
  },
  report: {
    createReport: {
      mutationOptions: () => ({ mutationKey: ["report", "create"] }),
    },
    updateReportStatus: {
      mutationOptions: () => ({ mutationKey: ["report", "updateStatus"] }),
    },
    getReportById: {
      queryOptions: () => ({ queryKey: ["report", "getById"] }),
    },
    addCoAuthorsToReport: {
      mutationOptions: () => ({ mutationKey: ["report", "addCoAuthors"] }),
    },
    addRequestedTeamsToReport: {
      mutationOptions: () => ({ mutationKey: ["report", "addRequestedTeams"] }),
    },
    getMyCreatedReportsTable: {
      queryOptions: () => ({
        queryKey: ["report", "getMyCreatedReportsTable"],
      }),
    },
    getMyRequestedReportsTable: {
      queryOptions: () => ({
        queryKey: ["report", "getMyRequestedReportsTable"],
      }),
    },
    getRecipientsByReportId: {
      queryOptions: () => ({ queryKey: ["report", "getRecipientsByReportId"] }),
    },
    getColleagues: {
      queryOptions: () => ({ queryKey: ["report", "getColleagues"] }),
    },
  },
  file: {
    uploadFiles: {
      mutationOptions: () => ({ mutationKey: ["file", "upload"] }),
    },
  },
  answer: {
    createAnswer: {
      mutationOptions: () => ({ mutationKey: ["answer", "create"] }),
    },
  },
};
