import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { emitUserEvent } from '../../lib/events';
import { SYSTEM_ACTION_IDS } from '../../lib/protocol';
import type { ShardProps } from '../../lib/euip';
import { useProjectionSizingMode } from '../../lib/projection-sizing';

interface ComponentShardProps extends ShardProps {
  children?: React.ReactNode;
}

export const Shard = React.forwardRef<HTMLDivElement, ComponentShardProps>(({
  title,
  children,
  closable,
  variant = 'solid',
  draggable = false
}, ref) => {
  const sizingMode = useProjectionSizingMode();
  const isIntrinsic = sizingMode === 'intrinsic';

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col w-full overflow-hidden transition-all duration-100",
        isIntrinsic ? "h-auto" : "h-full",
        // Base Border & Shape (v4: 0 radius, 4-corner brackets)
        "border border-border/20 rounded-none eidou-corners",
        // Neon Glow Shadow (Subtle)
        "shadow-neon-dim",
        // Variant Styles
        variant === 'solid' && "bg-card",
        variant === 'glass' && "bg-card/80 backdrop-blur-sm",
        variant === 'ghost' && "bg-transparent border-none shadow-none"
      )}
      // If draggable is true and NO title bar, make the whole body draggable
      data-tauri-drag-region={draggable && !title ? "true" : undefined}
    >
      {title && (
        <div
          className="flex justify-between items-center px-3 py-2 border-b border-border/20 bg-primary/5 cursor-grab select-none"
        >
          <div className="flex-1 min-w-0" data-tauri-drag-region>
            <span className="font-heading text-xs font-bold tracking-widest text-primary uppercase pointer-events-none">
              {title}
            </span>
          </div>
          {closable && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => emitUserEvent(SYSTEM_ACTION_IDS.CLOSE)}
              className="p-0.5 -mr-1"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-primary/50 hover:text-primary hover:drop-shadow-neon-sm transition-all" />
            </button>
          )}
        </div>
      )}
      <div
        className={cn(
          "p-4 text-foreground font-mono text-sm relative",
          isIntrinsic ? "flex-none" : "flex-1 min-h-0",
        )}
        data-tauri-drag-region={draggable && !title ? "true" : undefined}
      >
        {children}
      </div>
    </div>
  );
});

Shard.displayName = "Shard";
