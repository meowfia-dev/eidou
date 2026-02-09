import React from 'react';
import { cn } from '../../lib/utils';
import { getUniversalLayoutClasses } from '../../lib/semantic-styles';
import type { 
  BgToken, 
  OpacityToken,
  SpacingToken,
  ColorToken,
  RadiusToken,
  ShadowToken
} from '../../lib/tokens';

interface BoxProps {
  children?: React.ReactNode;
  width?: string | number;
  height?: string | number;
  
  bg?: BgToken;
  bgOpacity?: OpacityToken;
  
  title?: string;
  
  // Spacing
  p?: SpacingToken;
  px?: SpacingToken;
  py?: SpacingToken;
  m?: SpacingToken;
  mx?: SpacingToken;
  my?: SpacingToken;

  // Style
  border?: boolean;
  borderColor?: ColorToken;
  borderOpacity?: OpacityToken;
  rounded?: RadiusToken;
  shadow?: ShadowToken;

  /** Escape hatch for styles not covered by tokens. Only use when absolutely necessary. */
  _style?: React.CSSProperties;
}

export const Box = React.forwardRef<HTMLDivElement, BoxProps>(({ 
  children, 
  width, 
  height, 
  title,
  _style,
  ...layoutProps
}, ref) => {
  const inlineStyle: React.CSSProperties = {
    width, 
    height,
    ..._style
  };

  const classes = cn(
    "pointer-events-auto flex flex-col",
    getUniversalLayoutClasses(layoutProps)
  );

  return (
    <div 
      ref={ref}
      className={classes} 
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

Box.displayName = "Box";
