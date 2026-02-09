import React from 'react';
import { cn } from '../../lib/utils';
import { getUniversalLayoutClasses } from '../../lib/semantic-styles';
import type { PinnedProps } from '../../lib/euip';

interface ComponentPinnedProps extends PinnedProps {
  children?: React.ReactNode;
}

export const Pinned = React.forwardRef<HTMLDivElement, ComponentPinnedProps>((props, ref) => {
  const {
    children,
    top, left, right, bottom,
    width, height,
    zIndex,
    title,
    _style,
    ...layoutProps
  } = props;

  const universalClasses = getUniversalLayoutClasses(layoutProps);

  const inlineStyle: React.CSSProperties = {
    position: 'absolute',
    top, left, right, bottom,
    width, height,
    zIndex,
    ...(_style as React.CSSProperties)
  };

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto flex flex-col",
        universalClasses
      )}
      style={inlineStyle}
    >
      {title && (
        <div className="shrink-0 border-b border-border/10 bg-muted/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
          {title}
        </div>
      )}
      {children}
    </div>
  );
});

Pinned.displayName = "Pinned";
