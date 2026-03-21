import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono",
  {
    variants: {
      variant: {
        default: "bg-bg-base text-text-tertiary",
        running: "bg-status-running-muted text-status-running",
        stopped: "bg-status-stopped-muted text-status-stopped",
        pending: "bg-status-pending-muted text-status-pending",
        count: "text-text-tertiary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
