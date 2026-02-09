import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "../../lib/utils"

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number
  max?: number
  label?: string
  variant?: 'bar' | 'blocky' | 'scan'
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = 100, label, variant = 'bar', ...props }, ref) => {
    // For 'scan', we treat it as indeterminate.
    const isIndeterminate = variant === 'scan';
    const effectiveValue = isIndeterminate ? undefined : value;

    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <span className="text-xs font-mono text-foreground/70">{label}</span>}
            <ProgressPrimitive.Root
                ref={ref}
                className={cn(
                "relative h-4 w-full overflow-hidden rounded-none bg-primary/20",
                className
                )}
                {...props}
                value={effectiveValue}
                max={max}
            >
                <ProgressPrimitive.Indicator
                className={cn(
                    "h-full w-full flex-1 transition-all", 
                    variant === 'bar' && "bg-primary transition-transform duration-[660ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
                    variant === 'blocky' && "bg-[repeating-linear-gradient(90deg,currentColor,currentColor_4px,transparent_4px,transparent_8px)] text-primary transition-transform duration-[660ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
                    variant === 'scan' && "bg-primary w-1/3 animate-scan-indeterminate absolute top-0 bottom-0"
                )}
                style={{
                    transform: !isIndeterminate && value != null && max > 0 
                        ? `translateX(-${100 - (value / max) * 100}%)` 
                        : undefined
                }}
                />
            </ProgressPrimitive.Root>
        </div>
    )
  }
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
