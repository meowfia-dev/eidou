import React from 'react';
import { cn } from '../../lib/utils';
import {
  getTextSizeClass,
  getFontWeightClass,
  getTrackingClass,
  getTextColorClass,
} from '../../lib/semantic-styles';
import type { TextProps } from '../../lib/euip';

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>((props, ref) => {
  const {
    content,
    variant = 'body',
    size,
    weight,
    tracking,
    color,
    colorOpacity,
    align = 'start',
    glow,
    _style,
  } = props;

  // Base styles for variants (legacy support + defaults)
  const variantStyles = {
    h1: "font-heading text-2xl font-bold text-primary text-shadow-neon tracking-wide",
    h2: "font-heading text-xl font-bold text-foreground tracking-wide",
    h3: "font-heading text-lg font-semibold text-primary/80",
    body: "font-sans text-sm text-foreground",
    label: "font-mono text-xs text-foreground/50 uppercase tracking-wider",
    mono: "font-mono text-sm text-primary",
  };

  const alignStyles = {
    start: "text-left",
    center: "text-center",
    end: "text-right",
    justify: "text-justify",
  };

  // If semantic props are provided, they override variant defaults
  const semanticClasses = cn(
    getTextSizeClass(size),
    getFontWeightClass(weight),
    getTrackingClass(tracking),
    getTextColorClass(color, colorOpacity),
    alignStyles[align],
    glow && "text-shadow-neon"
  );

  // If no semantic props, use variant. If semantic props, use them ON TOP of variant (or instead?)
  // The goal is strict semantic styling.
  // If we are strictly following schema, the variant is just a preset.
  // We combine them: variant first, then semantic overrides.

  return (
    <p
      ref={ref}
      className={cn(variantStyles[variant], semanticClasses)}
      style={_style}
    >
      {content}
    </p>
  );
});

Text.displayName = "Text";
