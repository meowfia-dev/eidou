import React from 'react';
import { cn } from '../../lib/utils';
import type { FieldProps } from '../../lib/euip';
import { useProjectionSizingMode } from '../../lib/projection-sizing';

interface ComponentFieldProps extends FieldProps {
  children?: React.ReactNode;
}

const PADDING_MAP = {
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
};

const ALIGN_MAP = {
  start: 'items-start text-left',
  center: 'items-center text-center',
  end: 'items-end text-right',
  stretch: 'items-stretch text-left',
};

const OVERFLOW_MAP = {
  scroll: 'overflow-auto',
  clip: 'overflow-hidden',
  visible: 'overflow-visible',
};

export const Field = React.forwardRef<HTMLDivElement, ComponentFieldProps>(({
  children,
  safeArea,
  contentPadding,
  overflow = 'visible',
  maxInlineSize,
  align = 'start',
}, ref) => {
  const sizingMode = useProjectionSizingMode();
  const isIntrinsic = sizingMode === 'intrinsic';

  const styles = cn(
    'flex flex-col w-full',
    isIntrinsic ? 'h-auto' : 'h-full min-h-0',
    safeArea && 'p-4', // Override or add to contentPadding? Original was safeArea && 'p-4'.
    contentPadding && PADDING_MAP[contentPadding],
    overflow && OVERFLOW_MAP[overflow],
    align && ALIGN_MAP[align]
  );

  const style: React.CSSProperties = {};
  if (maxInlineSize) {
    style.maxWidth = typeof maxInlineSize === 'number' ? `${maxInlineSize}px` : maxInlineSize;
  }

  return (
    <div ref={ref} className={styles} style={style}>
      {children}
    </div>
  );
});

Field.displayName = "Field";
