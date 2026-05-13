import { Star } from "lucide-react";
import { useState } from "react";

interface Props {
  value: number;
  count?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}

export function StarRating({ value, count, size = 16, interactive = false, onChange }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;
  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = display >= i;
          const half = !filled && display >= i - 0.5;
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onMouseEnter={() => interactive && setHover(i)}
              onMouseLeave={() => interactive && setHover(null)}
              onClick={() => interactive && onChange?.(i)}
              className={interactive ? "cursor-pointer" : "cursor-default"}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
            >
              <Star
                style={{ width: size, height: size }}
                className={
                  filled || half
                    ? "fill-gold text-gold"
                    : "text-muted-foreground/40"
                }
              />
            </button>
          );
        })}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">
          {value.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}
