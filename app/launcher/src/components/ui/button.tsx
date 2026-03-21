import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all duration-100 cursor-pointer disabled:pointer-events-none disabled:opacity-30 shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-text-primary text-bg-base hover:opacity-85 active:opacity-70",
        secondary:
          "bg-transparent text-text-primary border border-border hover:bg-bg-surface-hover hover:border-border-hover",
        ghost:
          "bg-transparent text-text-secondary hover:text-text-primary hover:bg-accent-muted",
        icon:
          "bg-transparent border-none text-text-tertiary hover:text-text-primary hover:bg-white/[0.04] p-0",
        danger:
          "bg-transparent text-status-stopped hover:bg-status-stopped-muted",
      },
      size: {
        default: "h-8 px-4 py-1.5",
        sm: "h-7 px-3 py-1",
        lg: "h-9 px-5 py-2",
        icon: "h-7 w-7 p-1.5",
        "icon-sm": "h-6 w-6 p-1",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
