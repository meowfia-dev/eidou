import React, { forwardRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { emitUserEvent } from "../../lib/events";
import { USER_ACTION_IDS } from "../../lib/protocol";
import { cn } from "../../lib/utils";
import { useSyncedState } from "../../lib/hooks/useSyncedState";

interface CheckboxProps {
  checked: boolean;
  name: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  action?: string;
  style?: React.CSSProperties;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(({
  checked,
  name,
  label,
  disabled = false,
  className,
  action,
  style,
}, ref) => {
  const [localChecked, setLocalChecked] = useSyncedState<boolean | "indeterminate">(checked);

  const handleCheckedChange = (checked: boolean | "indeterminate") => {
    if (disabled) return;
    setLocalChecked(checked);
    const finalValue = checked === true;

    const actionId = action || USER_ACTION_IDS.INPUT_CHANGE;
    emitUserEvent(actionId, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value: finalValue });
  };

  return (
    <div className="flex items-center space-x-2" style={style}>
      <CheckboxPrimitive.Root
        ref={ref}
        id={name}
        className={cn(
          "peer h-5 w-5 shrink-0 rounded-none border border-primary/50 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-neon-dim disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary",
          className
        )}
        checked={localChecked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
      >
        <CheckboxPrimitive.Indicator
          className={cn("flex items-center justify-center text-primary")}
        >
          <Check className="h-4 w-4" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label
          htmlFor={name}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
        >
          {label}
        </label>
      )}
    </div>
  );
});

Checkbox.displayName = "Checkbox";
