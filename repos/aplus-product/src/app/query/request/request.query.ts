import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

interface UseCreateReportOptions {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useCreateReport(options?: UseCreateReportOptions) {
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.report.createReport.mutationOptions({
      onSuccess: options?.onSuccess,
      onError: options?.onError,
    }),
  );

  return {
    createReport: mutation.mutateAsync,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    isPending: mutation.isPending,
    isIdle: mutation.isIdle,
  };
}
