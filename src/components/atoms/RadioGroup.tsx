import React, { forwardRef } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { emitUserEvent } from "../../lib/events";
import { USER_ACTION_IDS } from "../../lib/protocol";
import { cn } from "../../lib/utils";
import { useSyncedState } from "../../lib/hooks/useSyncedState";

interface RadioOption {
  label: string;
  value: string;
}

interface RadioGroupProps {
  value: string;
  name: string;
  options: RadioOption[];
  disabled?: boolean;
  className?: string;
  action?: string;
  style?: React.CSSProperties;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(({
  value,
  name,
  options,
  disabled = false,
  className,
  action,
  style,
}, ref) => {
  const [localValue, setLocalValue] = useSyncedState(value);

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    setLocalValue(newValue);
    const actionId = action || USER_ACTION_IDS.INPUT_CHANGE;
    emitUserEvent(actionId, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value: newValue });
  };

  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn("grid gap-2", className)}
      style={style}
      value={localValue}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled}
    >
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <RadioGroupPrimitive.Item
            value={option.value}
            id={`${name}-${option.value}`}
            className="aspect-square h-4 w-4 rounded-none border border-primary/50 text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-neon-dim disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary flex items-center justify-center"
          >
            <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-none bg-primary" />
            </RadioGroupPrimitive.Indicator>
          </RadioGroupPrimitive.Item>
          <label
            htmlFor={`${name}-${option.value}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
          >
            {option.label}
          </label>
        </div>
      ))}
    </RadioGroupPrimitive.Root>
  );
});

RadioGroup.displayName = "RadioGroup";
