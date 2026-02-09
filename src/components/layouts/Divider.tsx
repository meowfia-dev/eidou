import React from 'react';
import { cn } from '../../lib/utils';
import { getBgFromColorToken, getTextColorClass } from '../../lib/semantic-styles';
import type { DividerProps } from '../../lib/euip';

export const Divider: React.FC<DividerProps> = ({
  direction = 'horizontal',
  content,
  align = 'center',
  color = 'primary',
  colorOpacity = '20',
  _style
}) => {
  const lineColorClass = getBgFromColorToken(color, colorOpacity);
  // Content text uses the same color family but more opaque by default for readability
  // If color is not set, defaults to primary/20 for line, primary/60 for text in original.
  const textColorClass = getTextColorClass(color, '60');

  const textClass = cn(
    "px-2 text-xs uppercase tracking-wider font-mono",
    textColorClass
  );

  if (direction === 'vertical') {
    return (
      <div className="flex flex-col items-center h-full mx-2" style={_style}>
        {align !== 'start' && <div className={cn("w-[1px] flex-1", lineColorClass)} />}
        {content && (
          <span className={cn("py-2 text-xs uppercase tracking-wider font-mono writing-mode-vertical", textColorClass)}>
            {content}
          </span>
        )}
        {align !== 'end' && <div className={cn("w-[1px] flex-1", lineColorClass)} />}
      </div>
    );
  }

  // Horizontal
  return (
    <div className="flex items-center w-full my-2" style={_style}>
      {align !== 'start' && <div className={cn("h-[1px] flex-1", lineColorClass)} />}
      {content && (
        <span className={textClass}>
          {content}
        </span>
      )}
      {align !== 'end' && <div className={cn("h-[1px] flex-1", lineColorClass)} />}
    </div>
  );
};
