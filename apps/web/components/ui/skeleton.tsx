import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800", className)}
      aria-hidden="true"
    />
  );
}
