import React, { forwardRef } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { emitUserEvent } from '../../lib/events';
import { USER_ACTION_IDS } from '../../lib/protocol';
import { cn } from '../../lib/utils';
import { useSyncedState } from '../../lib/hooks/useSyncedState';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  placeholder?: string;
  name: string;
  value?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  action?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(({
  options,
  placeholder,
  name,
  value,
  disabled = false,
  className,
  style,
  action,
}, ref) => {
  const [localValue, setLocalValue] = useSyncedState(value);

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    setLocalValue(newValue);
    const actionId = action || USER_ACTION_IDS.SELECT_CHANGE;
    emitUserEvent(actionId, {
      kind: USER_ACTION_IDS.SELECT_CHANGE,
      name,
      value: newValue,
    });
  };

  return (
    <SelectPrimitive.Root value={localValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          "inline-flex items-center justify-between rounded-none px-[15px] text-[13px] leading-none h-[35px] gap-[5px] bg-muted/5 text-primary border border-primary/30 hover:bg-primary/10 focus:shadow-[0_0_0_2px] focus:shadow-neon-dim outline-none cursor-pointer w-full font-mono disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        style={style}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="overflow-hidden bg-card/95 backdrop-blur-xl rounded-none border border-border/10 shadow-float z-50"
        >
          <SelectPrimitive.Viewport className="p-[5px]">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "text-[13px] leading-none text-foreground rounded-none flex items-center h-[25px] pr-[35px] pl-[25px] relative select-none data-[disabled]:opacity-50 data-[disabled]:pointer-events-none data-[highlighted]:bg-primary data-[highlighted]:text-primary-foreground outline-none cursor-default font-mono"
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});

Select.displayName = "Select";
