import React from 'react';
import { cn } from '../../lib/utils';
import { getUniversalLayoutClasses } from '../../lib/semantic-styles';
import type { StackProps } from '../../lib/euip';

interface ComponentStackProps extends StackProps {
  children?: React.ReactNode;
}

const ALIGN_MAP: Record<NonNullable<StackProps['align']>, string> = {
  'top-left': 'items-start justify-items-start',
  'top': 'items-start justify-items-center',
  'top-right': 'items-start justify-items-end',
  'left': 'items-center justify-items-start',
  'center': 'items-center justify-items-center',
  'right': 'items-center justify-items-end',
  'bottom-left': 'items-end justify-items-start',
  'bottom': 'items-end justify-items-center',
  'bottom-right': 'items-end justify-items-end',
};

export const Stack = React.forwardRef<HTMLDivElement, ComponentStackProps>((props, ref) => {
  const {
    children,
    fit = true,
    align = 'center',
    _style,
    ...layoutProps
  } = props;

  const universalClasses = getUniversalLayoutClasses(layoutProps);

  return (
    <div
      ref={ref}
      className={cn(
        "grid isolate", // isolate creates stacking context
        fit ? "w-full h-full" : "w-auto h-auto",
        ALIGN_MAP[align],
        universalClasses
      )}
      style={_style}
    >
      {React.Children.map(children, (child) => (
        <div className="col-start-1 row-start-1 pointer-events-none [&>*]:pointer-events-auto">
           {child}
        </div>
      ))}
    </div>
  );
});

Stack.displayName = "Stack";
