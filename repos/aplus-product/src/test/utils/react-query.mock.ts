export const mockUseQuery = jest.fn().mockImplementation((options) => {
  const queryKey = JSON.stringify(options.queryKey);
  if (queryKey.includes("user")) {
    if (queryKey.includes("random")) {
      return {
        data: {
          id: "user1",
          firstName: "John",
          lastName: "Doe",
          teams: [
            { id: "group1", name: "Group 1" },
            { id: "group2", name: "Group 2" },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    return {
      data: [
        { id: "user1", firstName: "John", lastName: "Doe" },
        { id: "user2", firstName: "Jane", lastName: "Smith" },
      ],
      isLoading: false,
      error: null,
    };
  }
  if (queryKey.includes("team")) {
    return {
      data: [
        {
          id: "group1",
          name: "Group 1",
          organization: {
            id: "structure1",
            name: "Structure 1",
            tags: [
              { id: "tag1", name: "Tag 1" },
              { id: "tag2", name: "Tag 2" },
            ],
          },
        },
      ],
      isLoading: false,
      error: null,
    };
  }
  if (queryKey.includes("report")) {
    return {
      data: {
        id: "test-report-id",
        status: "PENDING_ASSIGNMENT",
        subject: "Test Report",
        description: "Test Description",
        answers: [],
        files: [],
      },
      isLoading: false,
      error: null,
    };
  }
  return {
    data: [
      { id: "area1", name: "Area 1", value: "area1", label: "Area 1" },
      { id: "area2", name: "Area 2", value: "area2", label: "Area 2" },
    ],
    isLoading: false,
    error: null,
  };
});

export const mockUseMutation = jest.fn().mockImplementation(() => {
  return {
    mutateAsync: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  };
});
