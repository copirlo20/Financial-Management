import { cn } from "cn";
import { Wallet } from "lucide-react";

// The app's mark and name. onBrand: for use on the brand gradient, where the mark turns white.
export function Brand({ onBrand = false, className }: { onBrand?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
          onBrand ? "bg-white/15 text-white" : "bg-brand text-white",
        )}
      >
        <Wallet className="size-5" aria-hidden />
      </span>
      <span className="text-[15px] leading-tight font-bold tracking-tight">Financial Management</span>
    </span>
  );
}
