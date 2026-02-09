import React from 'react';
import type { SpacerProps } from '../../lib/euip';

interface ComponentSpacerProps extends SpacerProps {}

export const Spacer = React.forwardRef<HTMLDivElement, ComponentSpacerProps>(({ flex, size }, ref) => {
  const resolvedFlex = flex !== undefined ? flex : (size === undefined ? 1 : undefined);

  const style: React.CSSProperties = {
    width: size,
    height: size,
    flex: resolvedFlex ? (typeof resolvedFlex === 'number' ? resolvedFlex : 1) : undefined,
  };

  return <div ref={ref} style={style} />;
});

Spacer.displayName = "Spacer";
