/**
 * ProjectionEngine - EUIP Rendering Engine
 *
 * Converts EUIP JSON into React components with:
 * - Type-safe props validation
 * - Hierarchy enforcement
 * - Error boundary fallbacks
 *
 * @see /specification/v0_1/euip_schema_v0_1.md for protocol spec
 */

import React, { memo, forwardRef } from 'react';

// Layouts
import { Projection } from '../layouts/Projection';
import { Shard } from '../layouts/Shard';
import { Flex } from '../layouts/Flex';
import { Stack } from '../layouts/Stack';
import { Spacer } from '../layouts/Spacer';
import { Divider } from '../layouts/Divider';
import { ZStack } from '../layouts/ZStack';
import { ScrollArea } from '../layouts/ScrollArea';
import { Grid } from '../layouts/Grid';
import { Box } from '../layouts/Box';
import { Pinned } from '../layouts/Pinned';
import { Field } from '../layouts/Field';

// Atoms
import { Text } from '../atoms/Text';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Switch } from '../atoms/Switch';
import { Select } from '../atoms/Select';
import { Image } from '../atoms/Image';
import { Icon } from '../atoms/Icon';
import { Slider } from '../atoms/Slider';
import { Checkbox } from '../atoms/Checkbox';
import { RadioGroup } from '../atoms/RadioGroup';
import { Badge } from '../atoms/Badge';
import { CodeEditor } from '../atoms/CodeEditor';
import { Skeleton } from '../atoms/Skeleton';
import { Progress } from '../atoms/Progress';
import { Tooltip } from '../atoms/Tooltip';
import { Toast } from '../atoms/Toast';
import { Avatar } from '../atoms/Avatar';
import { Textarea } from '../atoms/Textarea';
import { Spinner } from '../atoms/Spinner';
import { Link } from '../atoms/Link';
import { Markdown } from '../atoms/Markdown';
import { Terminal } from '../atoms/Terminal';
import { Chart } from '../atoms/Chart';

// Providers
import { ThemeProvider, Theme } from '../providers/ThemeProvider';

// Local modules
import { ErrorGlitch } from './ErrorGlitch';
import { validateProps } from './validation';

// Types
import type { EuipNode, EuipType, EuipPropsByType } from '../../lib/euip';

// ============================================================================
// Context
// ============================================================================

/** Context to enforce "Rule of One" (No nested shards) */
const ShardContext = React.createContext<boolean>(false);

// ============================================================================
// Helpers
// ============================================================================

function mergeThemes(host?: Theme | null, protocol?: Theme | null): Theme | undefined {
  if (!host && !protocol) return undefined;
  if (!host) return protocol || undefined;
  if (!protocol) return host || undefined;

  const mergePart = <T extends object>(
    a: T | undefined | null,
    b: T | undefined | null
  ): T | undefined => {
    const validA = a || undefined;
    const validB = b || undefined;
    if (!validA && !validB) return undefined;
    if (!validA) return validB;
    if (!validB) return validA;
    return { ...validA, ...validB };
  };

  // Deep merge transitions: per-variant, with enter/exit sub-objects merged.
  const mergeTransitions = (
    a: Theme['transitions'],
    b: Theme['transitions'],
  ): Theme['transitions'] => {
    if (!a && !b) return undefined;
    if (!a) return b;
    if (!b) return a;
    const merged = { ...a };
    for (const [variant, def] of Object.entries(b)) {
      const existing = merged[variant];
      if (!existing) {
        merged[variant] = def;
      } else {
        merged[variant] = {
          seed_labels: def.seed_labels ?? existing.seed_labels,
          enter: mergePart(existing.enter, def.enter),
          exit: mergePart(existing.exit, def.exit),
        };
      }
    }
    return merged;
  };

  return {
    mode: protocol.mode ?? host.mode,
    colors: mergePart(host.colors, protocol.colors),
    radii: mergePart(host.radii, protocol.radii),
    tokens: mergePart(host.tokens, protocol.tokens),
    transitions: mergeTransitions(host.transitions, protocol.transitions),
  };
}

/** Remove dangerous props from EUIP nodes before rendering */
const sanitizeEuipProps = (rawProps: unknown): Record<string, unknown> | undefined => {
  if (!rawProps || typeof rawProps !== 'object' || Array.isArray(rawProps)) {
    return undefined;
  }

  const props = rawProps as Record<string, unknown>;

  if (!('dangerouslySetInnerHTML' in props)) return props;

  const { dangerouslySetInnerHTML, ...safeProps } = props;
  return safeProps;
};

// ============================================================================
// Types
// ============================================================================

type RenderNodeFn = (node: EuipNode, key: React.Key) => React.ReactNode;

type RegistryRenderFn<T extends EuipType> = (props: {
  node: Extract<EuipNode, { type: T }>;
  renderNode: RenderNodeFn;
  passthrough?: Record<string, unknown>;
  ref?: React.Ref<unknown>;
  hostTheme?: Theme;
  /** System-level: triggers exit animation on the root Projection. */
  closing?: boolean;
  /** System-level: called when exit animation completes. */
  onExitComplete?: () => void;
}) => React.ReactNode;

// ============================================================================
// Render Helpers
// ============================================================================

/** Render all children using the renderer */
const renderChildren = (node: EuipNode, renderNode: RenderNodeFn) => {
  return (node.children || []).map((child, i) => renderNode(child, i));
};

/**
 * Validated render helper for atoms with required props.
 * Returns ErrorGlitch if validation fails.
 */
function renderValidatedAtom<T extends EuipType>(
  type: T,
  node: EuipNode,
  render: (props: EuipPropsByType[T]) => React.ReactNode
): React.ReactNode {
  const result = validateProps(type, node.props);

  if (!result.valid) {
    if (import.meta.env.DEV) {
      console.error(`[EUIP] ${result.error}`, { node });
    }
    return (
      <ErrorGlitch
        type={type}
        message={result.error}
        code="ERR_MISSING_PROPS"
      />
    );
  }

  return render(result.props);
}

// ============================================================================
// Component Registry
// ============================================================================

const REGISTRY: { [K in EuipType]: RegistryRenderFn<K> } = {
  // === Containers ===

  projection: ({ node, renderNode, hostTheme, closing, onExitComplete }) => {
    const { theme, ...projectionProps } = (node.props ||
      {}) as EuipPropsByType['projection'];
    const mergedTheme = mergeThemes(hostTheme, theme);

    // Extract transitions from merged theme for Projection's three-layer resolution
    const themeTransitions = mergedTheme?.transitions;

    // Strict EUIP Hierarchy: Projection children MUST be 'field'
    const strictChildren = (node.children || []).map((child, i) => {
      if (child.type === 'field') {
        return renderNode(child, i);
      }
      return (
        <ErrorGlitch
          key={i}
          type={child.type}
          message="Hierarchy Violation: Projection children MUST be 'field'."
          code="ERR_HIERARCHY"
        />
      );
    });

    return (
      <ThemeProvider theme={mergedTheme}>
        <Projection
          {...projectionProps}
          themeTransitions={themeTransitions}
          closing={closing}
          onExitComplete={onExitComplete}
        >
          {strictChildren}
        </Projection>
      </ThemeProvider>
    );
  },

  shard: ({ node, ref, renderNode }) => (
    <Shard
      {...((node.props || {}) as EuipPropsByType['shard'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Shard>
  ),

  field: ({ node, renderNode }) => (
    <Field {...((node.props || {}) as EuipPropsByType['field'])}>
      {renderChildren(node, renderNode)}
    </Field>
  ),

  // === Layouts ===

  row: ({ node, ref, renderNode }) => (
    <Flex
      direction="row"
      {...((node.props || {}) as EuipPropsByType['row'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Flex>
  ),

  col: ({ node, ref, renderNode }) => (
    <Flex
      direction="column"
      {...((node.props || {}) as EuipPropsByType['col'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Flex>
  ),

  stack: ({ node, ref, renderNode }) => (
    <Stack
      {...((node.props || {}) as EuipPropsByType['stack'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Stack>
  ),

  grid: ({ node, ref, renderNode }) => (
    <Grid
      {...((node.props || {}) as EuipPropsByType['grid'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Grid>
  ),

  box: ({ node, ref, renderNode }) => (
    <Box
      {...((node.props || {}) as EuipPropsByType['box'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Box>
  ),

  pinned: ({ node, ref, renderNode }) => (
    <Pinned
      {...((node.props || {}) as EuipPropsByType['pinned'])}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      {renderChildren(node, renderNode)}
    </Pinned>
  ),

  zstack: ({ node, renderNode }) => (
    <ZStack {...((node.props || {}) as EuipPropsByType['zstack'])}>
      {renderChildren(node, renderNode)}
    </ZStack>
  ),

  scroll: ({ node, renderNode }) => (
    <ScrollArea {...((node.props || {}) as EuipPropsByType['scroll'])}>
      {renderChildren(node, renderNode)}
    </ScrollArea>
  ),

  // === Simple Atoms (no required props) ===

  spacer: ({ node }) => (
    <Spacer {...((node.props || {}) as EuipPropsByType['spacer'])} />
  ),

  divider: ({ node }) => (
    <Divider {...((node.props || {}) as EuipPropsByType['divider'])} />
  ),

  skeleton: ({ node }) => (
    <Skeleton {...((node.props || {}) as EuipPropsByType['skeleton'])} />
  ),

  progress: ({ node }) => (
    <Progress {...((node.props || {}) as EuipPropsByType['progress'])} />
  ),

  avatar: ({ node }) => (
    <Avatar {...((node.props || {}) as EuipPropsByType['avatar'])} />
  ),

  spinner: ({ node }) => (
    <Spinner {...((node.props || {}) as EuipPropsByType['spinner'])} />
  ),

  // === Validated Input Atoms ===

  input: ({ node }) =>
    renderValidatedAtom('input', node, (props) => <Input {...props} />),

  textarea: ({ node }) =>
    renderValidatedAtom('textarea', node, (props) => <Textarea {...props} />),

  switch: ({ node }) =>
    renderValidatedAtom('switch', node, (props) => <Switch {...props} />),

  select: ({ node }) =>
    renderValidatedAtom('select', node, (props) => <Select {...props} />),

  checkbox: ({ node }) =>
    renderValidatedAtom('checkbox', node, (props) => <Checkbox {...props} />),

  radiogroup: ({ node }) =>
    renderValidatedAtom('radiogroup', node, (props) => <RadioGroup {...props} />),

  slider: ({ node }) =>
    renderValidatedAtom('slider', node, (props) => <Slider {...props} />),

  codeeditor: ({ node }) =>
    renderValidatedAtom('codeeditor', node, (props) => <CodeEditor {...props} />),

  // === Validated Action Atoms ===

  button: ({ node, ref, passthrough }) =>
    renderValidatedAtom('button', node, (props) => (
      <Button
        {...(passthrough as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...props}
        ref={ref as React.Ref<HTMLButtonElement>}
      />
    )),

  // === Validated Display Atoms ===

  icon: ({ node, ref, passthrough }) =>
    renderValidatedAtom('icon', node, (props) => (
      <Icon
        {...(passthrough as React.SVGAttributes<SVGSVGElement>)}
        {...props}
        ref={ref as React.Ref<SVGSVGElement>}
      />
    )),

  image: ({ node, passthrough }) =>
    renderValidatedAtom('image', node, (props) => (
      <Image
        {...(passthrough as React.ImgHTMLAttributes<HTMLImageElement>)}
        {...props}
      />
    )),

  badge: ({ node }) =>
    renderValidatedAtom('badge', node, (props) => <Badge {...props} />),

  toast: ({ node }) =>
    renderValidatedAtom('toast', node, (props) => <Toast {...props} />),

  // === Atoms with children ===

  text: ({ node, ref }) => (
    <Text
      {...((node.props || {}) as EuipPropsByType['text'])}
      ref={ref as React.Ref<HTMLParagraphElement>}
    />
  ),

  tooltip: ({ node, renderNode }) =>
    renderValidatedAtom('tooltip', node, (props) => (
      <Tooltip {...props}>{renderChildren(node, renderNode)}</Tooltip>
    )),

  // === New Atoms ===

  link: ({ node }) =>
    renderValidatedAtom('link', node, (props) => <Link {...props} />),

  markdown: ({ node }) =>
    renderValidatedAtom('markdown', node, (props) => <Markdown {...props} />),

  terminal: ({ node }) =>
    renderValidatedAtom('terminal', node, (props) => <Terminal {...props} />),

  chart: ({ node }) =>
    renderValidatedAtom('chart', node, (props) => <Chart {...props} />),
};

// ============================================================================
// Node Renderer
// ============================================================================

interface NodeRendererProps {
  node: EuipNode;
  hostTheme?: Theme;
  /** System-level: triggers exit animation on the root Projection. */
  closing?: boolean;
  /** System-level: called when exit animation completes. */
  onExitComplete?: () => void;
  [key: string]: unknown;
}

const NodeRenderer = forwardRef<unknown, NodeRendererProps>((props, ref) => {
  const { node: untypedNode, hostTheme, closing, onExitComplete, ...passthrough } = props;

  const rawNode = untypedNode as EuipNode;

  // Sanitize props to prevent injection
  const node = {
    ...rawNode,
    props: sanitizeEuipProps(rawNode.props),
  } as EuipNode;

  // Rule of One: Check if we are already inside a Shard
  const isInsideShard = React.useContext(ShardContext);

  if (!node) return null;

  // Rule of One: Violation Check
  if (node.type === 'shard' && isInsideShard) {
    return (
      <ErrorGlitch
        type="shard"
        message="Rule of One: Nested Shards are forbidden."
        code="ERR_HIERARCHY"
      />
    );
  }

  // Get renderer from registry
  const Renderer = REGISTRY[node.type as EuipType] as RegistryRenderFn<EuipType>;

  if (!Renderer) {
    return <ErrorGlitch type={node.type} code="ERR_UNKNOWN_TYPE" />;
  }

  const renderNode: RenderNodeFn = (childNode, key) => (
    <NodeRenderer key={key} node={childNode} hostTheme={hostTheme} />
  );

  const content = Renderer({
    node: node as Extract<EuipNode, { type: EuipType }>,
    renderNode,
    passthrough,
    ref,
    hostTheme: hostTheme as Theme | undefined,
    closing: closing as boolean | undefined,
    onExitComplete: onExitComplete as (() => void) | undefined,
  });

  // Rule of One: Provide Context if this is a Shard
  if (node.type === 'shard') {
    return (
      <ShardContext.Provider value={true}>{content}</ShardContext.Provider>
    );
  }

  return content;
});

NodeRenderer.displayName = 'NodeRenderer';

// ============================================================================
// Export
// ============================================================================

export const ProjectionEngine = memo(NodeRenderer);
