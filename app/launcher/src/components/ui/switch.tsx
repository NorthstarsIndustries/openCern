import React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 data-[state=checked]:bg-text-primary data-[state=unchecked]:bg-white/[0.08]",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full transition-all duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-bg-base data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-text-tertiary",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export { Switch };
