import { forwardRef, type CSSProperties } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { emitUserEvent } from "../../lib/events";
import { USER_ACTION_IDS } from "../../lib/protocol";
import { cn } from "../../lib/utils";
import { useSyncedState } from "../../lib/hooks/useSyncedState";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  name: string;
  disabled?: boolean;
  className?: string;
  action?: string;
  style?: CSSProperties;
}

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(({
  value,
  min = 0,
  max = 100,
  step = 1,
  name,
  disabled = false,
  className,
  action,
  style,
}, ref) => {
  const [localValue, setLocalValue] = useSyncedState([value], [value]);

  const handleValueChange = (newValue: number[]) => {
    if (disabled) return;
    setLocalValue(newValue);
  };

  const handleValueCommit = (newValue: number[]) => {
    if (disabled) return;
    const actionId = action || USER_ACTION_IDS.INPUT_CHANGE;
    emitUserEvent(actionId, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value: newValue[0] });
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      style={style}
      value={localValue}
      min={min}
      max={max}
      step={step}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      disabled={disabled}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-none bg-primary/10">
        <SliderPrimitive.Range className="absolute h-full bg-primary shadow-neon-sm" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block h-4 w-4 rounded-none bg-primary shadow-neon hover:scale-110 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Slider"
      />
    </SliderPrimitive.Root>
  );
});

Slider.displayName = "Slider";
