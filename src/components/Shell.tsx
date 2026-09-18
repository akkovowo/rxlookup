import { type ReactNode } from "react";
import { AppLayout } from "./AppLayout";

export function Shell({ children }: { children?: ReactNode }) {
  void children;
  return <AppLayout />;
}
