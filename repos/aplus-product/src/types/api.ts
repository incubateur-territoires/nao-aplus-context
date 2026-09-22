export type ApiResponseList<T> = {
  ok: boolean;
  message?: string;
  data: T[];
  meta?: {
    page: number;
    take: number;
    itemCount: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
};

export type ApiChunkResponseList<T> = {
  ok: boolean;
  data: T[];
  meta: {
    itemCount: number;
    totalCount: number;
    currentChunk: number;
    hasMore: boolean;
    totalChunks: number;
  };
};
