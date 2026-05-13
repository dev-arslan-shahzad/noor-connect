export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
