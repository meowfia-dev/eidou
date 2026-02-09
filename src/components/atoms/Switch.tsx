import React, { forwardRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { emitUserEvent } from '../../lib/events';
import { USER_ACTION_IDS } from '../../lib/protocol';
import { cn } from '../../lib/utils';
import { useSyncedState } from '../../lib/hooks/useSyncedState';

interface SwitchProps {
  label?: string;
  checked?: boolean;
  name: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  action?: string;
}

export const Switch = forwardRef<HTMLDivElement, SwitchProps>(({
  label,
  checked: propChecked = false,
  name,
  disabled = false,
  className,
  style,
  action,
}, ref) => {
  const [checked, setChecked] = useSyncedState(propChecked);

  const handleCheckedChange = (newChecked: boolean) => {
    if (disabled) return;
    setChecked(newChecked);
    const actionId = action || USER_ACTION_IDS.SWITCH_CHANGE;
    emitUserEvent(actionId, {
      kind: USER_ACTION_IDS.SWITCH_CHANGE,
      name,
      value: newChecked,
    });
  };

  return (
    <div ref={ref} className={cn("flex items-center gap-3", className)} style={style}>
      <SwitchPrimitive.Root
        id={name}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        className={cn(
          "w-[42px] h-[25px] bg-overlay/50 rounded-none relative data-[state=checked]:bg-primary/20 border border-border/10 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block w-[21px] h-[21px] bg-thumb rounded-none transition-transform translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-primary"
          )}
        />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={name} className="text-foreground font-mono text-sm select-none">
          {label}
        </label>
      )}
    </div>
  );
});

Switch.displayName = "Switch";
