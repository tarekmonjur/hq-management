import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-400 focus:border-foreground dark:border-zinc-700",
        className,
      )}
      {...props}
    />
  );
}
