import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ label = "Verified" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
      <BadgeCheck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
