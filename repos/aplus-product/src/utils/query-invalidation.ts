import type { Query } from "@tanstack/react-query";

/**
 * Creates a predicate function for invalidating tRPC queries.
 * tRPC v11 uses nested query keys like [["router", "procedure"], { type: "query" }]
 */
export function createTRPCPredicate(
  router: string,
  procedures: string | string[],
) {
  const procedureList = Array.isArray(procedures) ? procedures : [procedures];

  return (query: Query) => {
    const key = query.queryKey;
    return (
      Array.isArray(key) &&
      Array.isArray(key[0]) &&
      key[0][0] === router &&
      procedureList.includes(key[0][1] as string)
    );
  };
}
