type Status = "upcoming" | "completed" | "cancelled" | "pending";

const styles: Record<Status, string> = {
  upcoming: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  pending: "bg-warning/15 text-warning-foreground",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const key = (status?.toLowerCase() as Status) || "pending";
  const cls = styles[key] ?? styles.pending;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}
