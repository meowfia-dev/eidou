import React from 'react';
import { cn } from '../../lib/utils';
import { 
  getGapClass, 
  getAlignClass, 
  getJustifyClass,
  getUniversalLayoutClasses
} from '../../lib/semantic-styles';
import type { 
  GapToken, 
  AlignToken, 
  JustifyToken,
  SpacingToken,
  BgToken,
  OpacityToken,
  ColorToken,
  RadiusToken,
  ShadowToken
} from '../../lib/tokens';

interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  gap?: GapToken;
  align?: AlignToken;
  justify?: JustifyToken;

  // Spacing
  p?: SpacingToken;
  px?: SpacingToken;
  py?: SpacingToken;
  m?: SpacingToken;
  mx?: SpacingToken;
  my?: SpacingToken;

  // Style
  bg?: BgToken;
  bgOpacity?: OpacityToken;
  border?: boolean;
  borderColor?: ColorToken;
  borderOpacity?: OpacityToken;
  rounded?: RadiusToken;
  shadow?: ShadowToken;

  /** Escape hatch for styles not covered by tokens. Only use when absolutely necessary. */
  _style?: React.CSSProperties;
}

export const Flex = React.forwardRef<HTMLDivElement, FlexProps>(({ 
  children, 
  direction = 'row', 
  gap = '2', 
  align = 'stretch', 
  justify = 'start',
  _style,
  ...layoutProps
}, ref) => {
  const classes = cn(
    'flex',
    direction === 'column' ? 'flex-col' : 'flex-row',
    getGapClass('gap', gap),
    getAlignClass(align),
    getJustifyClass(justify),
    getUniversalLayoutClasses(layoutProps)
  );

  return (
    <div 
      ref={ref} 
      className={classes}
      style={_style}
    >
      {children}
    </div>
  );
});

Flex.displayName = "Flex";
