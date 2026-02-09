import React from 'react';
import { cn } from '../../lib/utils';
import { getUniversalLayoutClasses } from '../../lib/semantic-styles';
import type { ScrollProps } from '../../lib/euip';
import { useProjectionSizingMode } from '../../lib/projection-sizing';

interface ComponentScrollProps extends ScrollProps {
  children?: React.ReactNode;
}

const OVERFLOW_CLASSES: Record<string, Record<string, string>> = {
  vertical: {
    auto: 'overflow-y-auto overflow-x-hidden',
    always: 'overflow-y-scroll overflow-x-hidden',
    hidden: 'overflow-y-auto overflow-x-hidden'
  },
  horizontal: {
    auto: 'overflow-x-auto overflow-y-hidden',
    always: 'overflow-x-scroll overflow-y-hidden',
    hidden: 'overflow-x-auto overflow-y-hidden'
  },
  both: {
    auto: 'overflow-auto',
    always: 'overflow-scroll',
    hidden: 'overflow-auto'
  }
};

const HIDDEN_SCROLLBAR_CLASS = "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]";

export const ScrollArea = React.forwardRef<HTMLDivElement, ComponentScrollProps>((props, ref) => {
  const {
    children,
    orientation = 'vertical',
    scrollbarVisibility = 'auto',
    _style,
    ...layoutProps
  } = props;
  const sizingMode = useProjectionSizingMode();
  const isIntrinsic = sizingMode === 'intrinsic';

  const universalClasses = getUniversalLayoutClasses(layoutProps);
  const overflowClass = OVERFLOW_CLASSES[orientation]?.[scrollbarVisibility] || OVERFLOW_CLASSES.vertical.auto;
  const hideScrollbarClass = scrollbarVisibility === 'hidden' ? HIDDEN_SCROLLBAR_CLASS : "";

  return (
    <div
      ref={ref}
      className={cn(
        "w-full",
        isIntrinsic ? "h-auto" : "h-full min-h-0",
        overflowClass,
        hideScrollbarClass,
        universalClasses
      )}
      style={_style}
    >
      {children}
    </div>
  );
});

ScrollArea.displayName = "ScrollArea";
