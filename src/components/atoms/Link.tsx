import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { emitUserEvent } from '../../lib/events';
import { USER_ACTION_IDS } from '../../lib/protocol';

interface LinkProps {
  label: string;
  href?: string;
  action?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({
  label,
  href,
  action,
  disabled = false,
  className,
  style,
}, ref) => {
  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (disabled) return;

    const actionId = action || USER_ACTION_IDS.LINK_NAVIGATE;
    await emitUserEvent(actionId, { kind: USER_ACTION_IDS.LINK_NAVIGATE, href: href || '' });
  };

  return (
    <a
      ref={ref}
      href={href || '#'}
      onClick={handleClick}
      className={cn(
        "text-primary hover:text-primary hover:drop-shadow-neon font-mono text-sm underline-offset-4 hover:underline transition-all group inline-flex items-center gap-1",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      style={style}
    >
      {label}
    </a>
  );
});

Link.displayName = "Link";
