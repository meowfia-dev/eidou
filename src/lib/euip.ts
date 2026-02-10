import React from 'react';
import type {
  BgToken,
  ColorToken,
  FontWeightToken,
  OpacityToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  TextSizeToken,
  TrackingToken,
} from "./tokens";

// Helper to extract props and omit children
type PropsOf<T extends React.ElementType> = Omit<React.ComponentProps<T>, 'children'>;

export interface UniversalStyleProps {
  _style?: Record<string, string | number>;
}

export interface UniversalLayoutProps extends UniversalStyleProps {
  p?: SpacingToken;
  px?: SpacingToken;
  py?: SpacingToken;
  m?: SpacingToken;
  mx?: SpacingToken;
  my?: SpacingToken;
  bg?: BgToken;
  bgOpacity?: OpacityToken;
  border?: boolean;
  borderColor?: ColorToken;
  borderOpacity?: OpacityToken;
  rounded?: RadiusToken;
  shadow?: ShadowToken;
}

export interface TextProps extends UniversalStyleProps {
  content?: string;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'mono';
  size?: TextSizeToken;
  weight?: FontWeightToken;
  tracking?: TrackingToken;
  color?: ColorToken;
  colorOpacity?: OpacityToken;
  align?: 'start' | 'center' | 'end' | 'justify';
  glow?: boolean;
}

export interface DividerProps extends UniversalStyleProps {
  direction?: 'horizontal' | 'vertical';
  content?: string;
  align?: 'start' | 'center' | 'end';
  color?: ColorToken;
  colorOpacity?: OpacityToken;
}

export interface StackProps extends UniversalLayoutProps {
  fit?: boolean;
  align?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
}

export interface ZStackProps extends UniversalLayoutProps {
  align?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';
}

export interface ScrollProps extends UniversalLayoutProps {
  orientation?: 'vertical' | 'horizontal' | 'both';
  scrollbarVisibility?: 'auto' | 'always' | 'hidden';
}

export interface PinnedProps extends UniversalLayoutProps {
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  width?: string | number;
  height?: string | number;
  zIndex?: number;
  title?: string;
}

export interface FieldProps {
  safeArea?: boolean;
  contentPadding?: 'sm' | 'md' | 'lg';
  overflow?: 'scroll' | 'clip' | 'visible';
  maxInlineSize?: number | string;
  align?: 'center' | 'start' | 'end' | 'stretch';
}

export interface ShardProps {
  title?: string;
  closable?: boolean;
  variant?: 'glass' | 'solid' | 'ghost';
  draggable?: boolean;
}

export interface SpacerProps {
  size?: string | number;
  flex?: boolean | number;
}

export interface EuipPropsByType {
  // Containers
  projection: PropsOf<typeof import('../components/layouts/Projection').Projection> & { theme?: React.ComponentProps<typeof import('../components/providers/ThemeProvider').ThemeProvider>['theme'] };
  shard: ShardProps;
  row: Omit<PropsOf<typeof import('../components/layouts/Flex').Flex>, 'direction'>;
  col: Omit<PropsOf<typeof import('../components/layouts/Flex').Flex>, 'direction'>;
  stack: StackProps;
  grid: PropsOf<typeof import('../components/layouts/Grid').Grid>;
  spacer: SpacerProps;
  divider: DividerProps;
  zstack: ZStackProps;
  scroll: ScrollProps;
  box: PropsOf<typeof import('../components/layouts/Box').Box>;
  pinned: PinnedProps;
  field: FieldProps;

  // Atoms
  text: TextProps;
  button: PropsOf<typeof import('../components/atoms/Button').Button>;
  input: PropsOf<typeof import('../components/atoms/Input').Input>;
  switch: PropsOf<typeof import('../components/atoms/Switch').Switch>;
  select: PropsOf<typeof import('../components/atoms/Select').Select>;
  image: PropsOf<typeof import('../components/atoms/Image').Image>;
  icon: PropsOf<typeof import('../components/atoms/Icon').Icon>;
  slider: PropsOf<typeof import('../components/atoms/Slider').Slider>;
  checkbox: PropsOf<typeof import('../components/atoms/Checkbox').Checkbox>;
  radiogroup: PropsOf<typeof import('../components/atoms/RadioGroup').RadioGroup>;
  badge: PropsOf<typeof import('../components/atoms/Badge').Badge>;
  codeeditor: PropsOf<typeof import('../components/atoms/CodeEditor').CodeEditor>;
  skeleton: PropsOf<typeof import('../components/atoms/Skeleton').Skeleton>;
  progress: PropsOf<typeof import('../components/atoms/Progress').Progress>;
  tooltip: PropsOf<typeof import('../components/atoms/Tooltip').Tooltip>;
  toast: PropsOf<typeof import('../components/atoms/Toast').Toast>;
  avatar: PropsOf<typeof import('../components/atoms/Avatar').Avatar>;
  textarea: PropsOf<typeof import('../components/atoms/Textarea').Textarea>;
  spinner: PropsOf<typeof import('../components/atoms/Spinner').Spinner>;
  link: PropsOf<typeof import('../components/atoms/Link').Link>;
  markdown: PropsOf<typeof import('../components/atoms/Markdown').Markdown>;
  terminal: PropsOf<typeof import('../components/atoms/Terminal').Terminal>;
  chart: import('../components/atoms/chart/types').ChartProps;
}

export type EuipType = keyof EuipPropsByType;

// Recursive definition
export type EuipNode = {
  [K in EuipType]: {
    type: K;
    props?: EuipPropsByType[K];
    children?: EuipNode[];
  }
}[EuipType];
