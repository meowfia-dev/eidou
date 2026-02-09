import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "../../lib/utils"

export interface TooltipProps {
  children: React.ReactNode
  content: string | React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  delay?: number
  className?: string
  style?: React.CSSProperties
}

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delay = 200,
  className,
  style,
}: TooltipProps) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(document.getElementById('eidou-portal-root'));
  }, []);

  // Robust unwrapping: Handle single child array or direct child
  const trigger = React.useMemo(() => {
    if (Array.isArray(children)) {
       return children.length === 1 ? children[0] : children;
    }
    return children;
  }, [children]);

  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>
        {trigger}
      </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={container || undefined}>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={4}
          className={cn(
            "z-[9999] pointer-events-auto rounded-none border border-primary/30 bg-card/90 px-2 py-1 text-xs font-mono text-foreground shadow-neon-sm backdrop-blur animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          style={style}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-primary/30" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
