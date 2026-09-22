import { ApiResponse } from "@/types/api";
import { FileMetadata } from "@/types/file";
import { useMutation } from "@tanstack/react-query";

export async function uploadFiles(
  files: File[],
): Promise<ApiResponse<FileMetadata[]>> {
  if (!files || files.length === 0) {
    return { data: [], ok: true };
  }

  const formData = new FormData();
  files.forEach((f) => formData.append("file", f));

  const response = await fetch("/api/upload-files", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  return data;
}

export function useUploadFiles() {
  return useMutation({
    mutationFn: uploadFiles,
  });
}
