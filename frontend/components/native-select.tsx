import { cn } from "cn";
import * as React from "react";

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base shadow-xs outline-none md:text-sm dark:bg-secondary",
        // The list that opens is drawn by the browser from these colours, and it ignores transparency (a
        // translucent field background comes out white), so both are solid.
        "[&_option]:bg-popover [&_option]:text-popover-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}
