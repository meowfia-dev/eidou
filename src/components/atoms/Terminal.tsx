import React, { forwardRef, useEffect, useRef, useCallback } from 'react';
import AnsiToHtml from 'ansi-to-html';
import { cn } from '../../lib/utils';

interface TerminalProps {
  lines: string[];
  autoScroll?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const ansiConverter = new AnsiToHtml({
  fg: 'rgb(var(--eidou-color-primary-rgb))',
  bg: 'rgb(var(--eidou-color-surface-rgb))',
  newline: true,
  escapeXML: true,
  colors: [
    // 0-7: Normal ANSI colors (aligned with Eidou tokens)
    '#1a1a1e',                                // 0 Black (void-ish)
    'rgb(239, 68, 68)',                        // 1 Red -> danger
    'rgb(34, 197, 94)',                        // 2 Green -> success
    'rgb(202, 138, 4)',                        // 3 Yellow -> warning (toned down from harsh yellow)
    'rgb(0, 240, 255)',                        // 4 Blue -> info (hologram cyan)
    'rgb(168, 85, 247)',                       // 5 Magenta -> purple-500
    'rgb(0, 240, 255)',                        // 6 Cyan -> info
    'rgb(203, 213, 225)',                      // 7 White -> text (slate-300)
    // 8-15: Bright variants
    'rgb(100, 116, 139)',                      // 8 Bright Black -> text-muted (slate-500)
    'rgb(252, 129, 129)',                      // 9 Bright Red -> danger lighter
    'rgb(134, 239, 172)',                      // 10 Bright Green -> success lighter
    'rgb(234, 179, 8)',                        // 11 Bright Yellow -> warning
    'rgb(103, 232, 249)',                      // 12 Bright Blue -> cyan lighter
    'rgb(216, 180, 254)',                      // 13 Bright Magenta -> purple lighter
    'rgb(103, 232, 249)',                      // 14 Bright Cyan -> cyan lighter
    '#ffffff',                                 // 15 Bright White
  ],
});

export const Terminal = forwardRef<HTMLDivElement, TerminalProps>(({
  lines,
  autoScroll = true,
  className,
  style,
}, ref) => {
  const internalRef = useRef<HTMLDivElement>(null);

  // Merge forwarded ref with internal ref via callback
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    // Assign to internal ref
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Forward to external ref
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [ref]);

  useEffect(() => {
    if (autoScroll && internalRef.current) {
      internalRef.current.scrollTop = internalRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  return (
    <div
      ref={mergedRef}
      className={cn(
        "w-full h-full overflow-auto bg-card text-primary font-mono text-sm p-4 rounded-none border border-primary/20",
        className
      )}
      style={style}
    >
      {lines.map((line, index) => (
        <div
          key={index}
          dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(line) }}
        />
      ))}
    </div>
  );
});

Terminal.displayName = "Terminal";
