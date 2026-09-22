"use client";

import { usePageViewTracking } from "@/app/hooks/use-analytics";
import type { ReactNode } from "react";

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  usePageViewTracking();

  return <>{children}</>;
}
