import React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }
>(({ className, hover, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-border bg-bg-surface overflow-hidden",
      hover &&
        "transition-[background-color,border-color] duration-100 hover:bg-bg-surface-hover hover:border-border-hover",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 px-4 py-3", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-4 pb-3 border-t border-border", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardContent };
