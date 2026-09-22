import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { uploadFiles, useUploadFiles } from "./file.query";
import { ApiResponse } from "@/types/api";
import React from "react";
import { FileMetadata } from "@/types/file";

describe("file.query", () => {
  describe("uploadFiles", () => {
    const mockFiles = [
      new File(["test content"], "test1.txt", { type: "text/plain" }),
      new File(["test content 2"], "test2.txt", { type: "text/plain" }),
    ];

    const mockResponse: ApiResponse<FileMetadata[]> = {
      ok: true,
      data: [
        {
          id: "1",
          name: "test1.txt",
          size: 12,
          type: "text/plain",
          lastModified: new Date(Date.now()),
        },
        {
          id: "2",
          name: "test2.txt",
          size: 13,
          type: "text/plain",
          lastModified: new Date(Date.now()),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fetchMock: any;

    beforeEach(() => {
      jest.clearAllMocks();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );
      fetchMock = global.fetch;
    });

    it("should upload files successfully", async () => {
      const result = await uploadFiles(mockFiles);

      expect(fetchMock).toHaveBeenCalledWith("/api/upload-files", {
        method: "POST",
        body: expect.any(FormData),
      });

      const { body } = fetchMock.mock.calls[0][1] as { body: FormData };
      expect(body.get("file")).toBeInstanceOf(File);
      expect(result).toEqual(mockResponse);
    });

    it("should handle upload error", async () => {
      const errorResponse = { ok: false, message: "Upload failed" };
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve(errorResponse),
        } as Response),
      );

      const result = await uploadFiles(mockFiles);
      expect(result).toEqual(errorResponse);
    });
  });

  describe("useUploadFiles", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      );
    };

    beforeEach(() => {
      jest.clearAllMocks();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = jest.fn();
    });

    it("should return mutation object with correct properties", () => {
      const { result } = renderHook(() => useUploadFiles(), { wrapper });

      expect(result.current).toHaveProperty("mutateAsync");
      expect(result.current).toHaveProperty("isPending");
      expect(result.current).toHaveProperty("isError");
      expect(result.current).toHaveProperty("error");
    });
  });
});
