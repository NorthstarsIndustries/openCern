import React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "w-full rounded-md border border-border bg-bg-base px-3 py-2 text-xs text-text-primary font-mono outline-none transition-colors duration-100 placeholder:text-text-tertiary focus:border-white/25",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
