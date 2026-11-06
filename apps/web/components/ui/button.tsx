import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
