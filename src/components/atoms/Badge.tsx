import React, { forwardRef } from "react";
import { X } from "lucide-react";
import { emitUserEvent } from "../../lib/events";
import { USER_ACTION_IDS } from "../../lib/protocol";
import { cn } from "../../lib/utils";

interface BadgeProps {
  label: string;
  name?: string;
  variant?: "solid" | "outline" | "ghost";
  color?: string;
  removable?: boolean;
  className?: string;
  action?: string;
  style?: React.CSSProperties;
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(({
  label,
  name,
  variant = "solid",
  color = "primary",
  removable = false,
  className,
  action,
  style,
}, ref) => {
  const baseStyles = "inline-flex items-center rounded-none px-2.5 py-0.5 text-xs font-semibold transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-neon-dim";
  
  const variants = {
    solid: "bg-primary text-primary-foreground hover:bg-primary/80 border-transparent",
    outline: "text-foreground border border-primary/50 hover:bg-primary/10",
    ghost: "text-foreground hover:bg-primary/10 border-transparent",
  };

  const customStyle = color !== "primary" ? {
    backgroundColor: variant === "solid" ? color : undefined,
    color: variant === "solid" ? "rgb(var(--eidou-color-primary-foreground-rgb))" : color,
    borderColor: variant === "outline" ? color : undefined,
  } : undefined;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    const actionId = action || USER_ACTION_IDS.REMOVE_BADGE;
    emitUserEvent(actionId, { kind: USER_ACTION_IDS.REMOVE_BADGE, name: name || null, value: label });
  };

  return (
    <div
      ref={ref}
      className={cn(baseStyles, variants[variant], className)}
      style={{ ...customStyle, ...style }}
    >
      {label}
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-1 -mr-1 h-3.5 w-3.5 rounded-none p-0 hover:bg-muted inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-neon-dim"
          aria-label={`Remove ${label}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
});

Badge.displayName = "Badge";
