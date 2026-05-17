import { AlertCircle } from "lucide-react";

/**
 * Flatten DRF-style error shapes into a single human-readable string.
 * Accepts strings, arrays of strings, or {field: [msg, ...]} dicts (and nested mixes).
 */
export function formatApiError(input: unknown, fallback = "Something went wrong."): string {
  if (input == null) return fallback;
  if (typeof input === "string") return input;
  if (Array.isArray(input)) {
    return input.map((v) => formatApiError(v, "")).filter(Boolean).join(" ") || fallback;
  }
  if (typeof input === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const msg = formatApiError(v, "");
      if (!msg) continue;
      // Skip the field name for the common single-field case (e.g. "email"),
      // since the message is usually enough on its own.
      parts.push(msg);
      void k;
    }
    return parts.join(" ") || fallback;
  }
  return String(input);
}

export function ErrorMessage({ message }: { message?: unknown }) {
  if (!message) return null;
  const text = typeof message === "string" ? message : formatApiError(message);
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
