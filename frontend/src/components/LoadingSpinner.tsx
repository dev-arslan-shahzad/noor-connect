export function LoadingSpinner({
  label,
  size = "md",
  fullScreen = false,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}) {
  const sizeCls =
    size === "lg"
      ? "h-20 w-20 border-4"
      : size === "sm"
        ? "h-6 w-6 border-2"
        : "h-8 w-8 border-2";
  const containerCls = fullScreen
    ? "flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground"
    : "flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground";
  return (
    <div className={containerCls}>
      <div className={`${sizeCls} rounded-full border-primary border-t-transparent animate-spin`} />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
