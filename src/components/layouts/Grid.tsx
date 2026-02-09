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
  SpacingToken,
  BgToken,
  OpacityToken,
  ColorToken,
  RadiusToken,
  ShadowToken,
  AlignToken,
  JustifyToken
} from '../../lib/tokens';

interface GridProps {
  children: React.ReactNode;
  columns?: number;
  minItemWidth?: string;
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

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(({ 
  children, 
  columns = 2, 
  minItemWidth,
  gap = "2",
  align,
  justify,
  _style,
  ...layoutProps
}, ref) => {
  const inlineStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: minItemWidth 
      ? `repeat(auto-fit, minmax(${minItemWidth}, 1fr))`
      : `repeat(${columns}, minmax(0, 1fr))`,
    ..._style
  };

  const classes = cn(
    "w-full",
    getGapClass("gap", gap),
    getAlignClass(align),
    getJustifyClass(justify),
    getUniversalLayoutClasses(layoutProps)
  );

  return (
    <div ref={ref} className={classes} style={inlineStyle}>
      {children}
    </div>
  );
});

Grid.displayName = "Grid";
