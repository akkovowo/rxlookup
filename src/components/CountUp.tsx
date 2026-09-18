import { formatUsd, remainParts } from "@/lib/format";
import { useCountUp } from "@/lib/countUp";

export function CountUsd({
  cents,
  delay = 0,
}: {
  cents: number;
  delay?: number;
}) {
  const n = useCountUp(cents, { delay });
  return <>{formatUsd(Math.round(n))}</>;
}

export function CountDollars({
  amount,
  delay = 0,
}: {
  amount: number;
  delay?: number;
}) {
  const n = useCountUp(amount, { delay });
  return <>${Math.round(n)}</>;
}

export function CountRemain({
  until,
  active,
  fallback = "Inactive",
}: {
  until: string | null | undefined;
  active: boolean;
  fallback?: string;
}) {
  const parts = active ? remainParts(until) : null;
  const days = useCountUp(parts?.days ?? 0);
  const hours = useCountUp(parts?.hours ?? 0);
  const minutes = useCountUp(parts?.minutes ?? 0);
  if (!parts) return <>{fallback}</>;
  if (parts.days > 0) return <>{`${Math.round(days)}d ${Math.round(hours)}h`}</>;
  return <>{`${Math.round(hours)}h ${Math.round(minutes)}m`}</>;
}
