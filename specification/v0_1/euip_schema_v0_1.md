# EUIP (Eidou UI Protocol) v0.1

Canonical specification for the Eidou User Interface Protocol.

## 1. Node Structure

All UI elements are nodes in a tree.

```json
{
  "type": "string",
  "props": { ... },
  "children": [ ... ]
}
```

- **`type`** (required): The canonical component identifier (e.g., `button`, `row`).
- **`props`** (required): Configuration object.
- **`children`** (optional): Array of child nodes.

## 2. Universal Props

Strict components do **not** accept `className` or `style`.
They use semantic props (tokens) and a dedicated escape hatch:

- **`_style`** (object): Inline style object for escape-hatch overrides.

## 3. Strict Hierarchy Rules

**EUIP enforces a strict component hierarchy. Violations will be rejected by the backend.**

### 3.1 Hierarchy Overview

```
projection (root)
    |
    +-- field (exactly 1, OS adaptation layer)
            |
            +-- shard (optional, visual container)
            |       |
            |       +-- layouts (row/col/grid/stack/box/pinned/zstack/scroll)
            |       |       |
            |       |       +-- layouts / atoms
            |       |
            |       +-- atoms (text/button/input/...)
            |
            +-- layouts (row/col/grid/stack/box/pinned/zstack/scroll)
            |       |
            |       +-- layouts / atoms (NO shard allowed here)
            |
            +-- atoms
```

### 3.2 Enforced Rules

| Rule | Description |
|------|-------------|
| `SINGLE_FIELD` | Projection MUST have exactly 1 `field` child. |
| `NO_NESTED_FIELD` | `field` cannot appear inside any other component. |
| `SHARD_ONLY_IN_FIELD` | `shard` can ONLY appear as a direct child of `field`. |
| `NO_NESTED_SHARD` | `shard` cannot contain another `shard`. |

### 3.3 Validation Error Response

When a widget structure violates these rules, the backend returns an error:

```json
{
  "code": -32602,
  "message": "EUIP Validation Failed",
  "data": {
    "code": "EUIP_VALIDATION_ERROR",
    "violations": [
      {
        "rule": "NO_NESTED_FIELD",
        "message": "Field cannot appear inside another component",
        "path": "$.children[0].children[0]"
      }
    ],
    "hint": "EUIP hierarchy: projection -> field (exactly 1) -> shard (optional) -> layouts/atoms"
  }
}
```

## 4. Canonical Component List

**Strict Rule:** No aliases allowed. Use exact type names.

### Containers & Layouts

| Type | Description |
|------|-------------|
| `projection` | **Root** window container. |
| `shard` | Fundamental content container (window-like). |
| `field` | **OS adaptation layer** (safe area, padding). Exactly 1 per projection. |
| `scroll` | Scrollable container. |
| `row` | Horizontal flex layout. |
| `col` | Vertical flex layout. |
| `stack` | Simple stacking container. |
| `zstack` | Z-axis overlay container. |
| `grid` | 2D grid layout. |
| `box` | In-flow container with optional sizing/background. |
| `pinned` | Absolute positioning container (use sparingly). |

### Atoms & Elements

| Type | Description |
|------|-------------|
| `text` | Typography. |
| `button` | Interactive trigger. |
| `input` | Text input. |
| `switch` | Boolean toggle. |
| `select` | Dropdown menu. |
| `checkbox` | Boolean checkbox. |
| `radiogroup` | Radio button set. |
| `slider` | Range input. |
| `image` | Image display. |
| `icon` | SVG icon (Lucide). |
| `codeeditor` | Monaco-like editor. |
| `badge` | Status indicator. |
| `skeleton` | Loading placeholder. |
| `progress` | Progress bar/circle. |
| `tooltip` | Hover info. |
| `toast` | Notification. |
| `avatar` | User/Entity avatar. |
| `textarea` | Multi-line text input. |
| `spinner` | Loading indicator. |
| `divider` | Visual separator. |
| `spacer` | Flexible space. |
| `link` | Hyperlink or action trigger. |
| `markdown` | Markdown content renderer. |
| `terminal` | Terminal output display. |
| `chart` | Data visualization (line/bar/pie/area). |

## 4. Component Props Specification

### `projection` (Root)
- **Strict Rule:** `children` MUST contain exactly ONE `field` node.
- `title` (string): Window title.
- `size` (string | object): `sm`, `md`, `lg`, `xl`, `full`, `auto`, `{ width: number|"auto", height: number|"auto" }` (including hybrid per-axis auto), or `{ ratio: "16:9", width?: number, maxWidth?: number, base?: "sm"|"md"|"lg"|"xl" }`.
- `position` (object): Window positioning.
  - `anchor` (enum): `center`, `top-right`, `bottom-right`, `top-left`, `bottom-left`, `custom`.
  - `offset` (object, optional): `{ x, y }` coordinates.
- `transition` (object, optional): Animation configuration.
  - `variant` (enum): `default`, `tactical`, `glitch`, `stealth`, `alert`, `success`.
  - `speed` (enum): `fast`, `normal`, `slow`.
  - `seed` (boolean): Show pre-loader capsule (default: true).
- `theme` (object): Theme configuration.
  - `mode` ("light" | "dark"): Switch global theme mode.
  - `colors` (object, optional): Partial overrides for `bg`, `surface`, `text`, `primary`, `border`.
  - `radii` (object, optional): Partial overrides for `base`.
  - `tokens` (object, optional): Legacy support for v1 tokens.

### `shard`
- **Strict Rule:** Shard can ONLY appear as a direct child of `field`. Nested shards are forbidden.
- `variant` (enum): `glass`, `solid`, `ghost`.
- `title` (string): Header title.
- `closable` (boolean): Show close button.
- `draggable` (boolean): If true and no `title`, make the shard body draggable.

### `field`
- **Strict Styling:** No `className` or `style`.
- `safeArea` (boolean): Respect OS safe areas.
- `contentPadding` (enum): `sm`, `md`, `lg`.
- `overflow` (enum): `scroll`, `clip`, `visible`.
- `maxInlineSize` (number|string): Max width constraint.
- `align` (enum): `center`, `start`, `end`, `stretch`.

### `spacer`
- `size` (string|number): Fixed size.
- `flex` (boolean|number): Flex grow factor.

### `divider`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `direction` (enum): `horizontal`, `vertical`.
- `content` (string): Label content.
- `align` (enum): `start`, `center`, `end`.
- `color` (ColorToken): Line color.
- `colorOpacity` (OpacityToken): Line opacity.
- `_style` (object): Escape hatch.

### `button`
- **`action`** (string, **REQUIRED**): Event ID to emit on click.
- `label` (string): Display text.
- `variant` (enum): `primary`, `secondary`, `ghost`, `danger`.
- `disabled` (boolean): Disable interaction.
- `loading` (boolean): Show loading spinner and disable interaction.

### `stack`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `fit` (boolean): Fit content.
- `align` (enum): `center`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `top`, `bottom`, `left`, `right`.
- **Spacing/Visual:** Same as `row`/`col` (p, m, bg, border, rounded, shadow, _style).

### `zstack`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `align` (enum): `center`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `top`, `bottom`, `left`, `right`.
- **Spacing/Visual:** Same as `row`/`col` (p, m, bg, border, rounded, shadow, _style).

### `scroll`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `orientation` (enum): `vertical`, `horizontal`, `both`.
- `scrollbarVisibility` (enum): `auto`, `always`, `hidden`.
- **Spacing/Visual:** Same as `row`/`col` (p, m, bg, border, rounded, shadow, _style).

### `row` / `col`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `gap` (GapToken): Space between items.
- `align` (AlignToken): `start`, `center`, `end`, `stretch`.
- `justify` (JustifyToken): `start`, `center`, `end`, `between`, `around`.
- **Spacing:** `p`, `px`, `py`, `m`, `mx`, `my` (SpacingToken).
- **Visual:**
  - `bg` (BgToken), `bgOpacity` (OpacityToken).
  - `border` (boolean), `borderColor` (ColorToken), `borderOpacity` (OpacityToken).
  - `rounded` (RadiusToken).
  - `shadow` (ShadowToken).
- `_style` (object): Escape hatch for inline styles.

### `grid`
- `columns` (number): Fixed column count.
- `minItemWidth` (string|number): Responsive column width.
- `gap` (string|number): Grid gap.

### `box`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `width`, `height` (string|number): Container size.
- `bg` (BgToken): Background color token.
- `title` (string): Optional lightweight header title.
- **Spacing:** `p`, `px`, `py`, `m`, `mx`, `my` (SpacingToken).
- **Visual:**
  - `bgOpacity` (OpacityToken).
  - `border` (boolean), `borderColor` (ColorToken), `borderOpacity` (OpacityToken).
  - `rounded` (RadiusToken).
  - `shadow` (ShadowToken).
- `_style` (object): Escape hatch for inline styles.

### `pinned`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `top`, `left`, `right`, `bottom`, `width`, `height` (string|number): Absolute positioning.
- `zIndex` (number): Stacking order.
- `bg` (BgToken): Background color token.
- `bgOpacity` (OpacityToken): Background opacity.
- `title` (string): Optional lightweight header title.
- **Spacing/Visual:** Same as `row`/`col` (p, m, border, rounded, shadow, _style).

### `text`
- **Strict Styling:** No `className` or `style`. Use semantic props or `_style`.
- `content` (string): Text body.
- `variant` (enum): `h1`..`h3`, `body`, `label`, `mono`.
- `size` (TextSizeToken): Text size.
- `weight` (FontWeightToken): Font weight.
- `tracking` (TrackingToken): Letter spacing.
- `color` (ColorToken): Text color.
- `colorOpacity` (OpacityToken): Text color opacity.
- `align` (enum): `start`, `center`, `end`, `justify`.
- `glow` (boolean): Apply neon glow effect.
- `_style` (object): Escape hatch.

### `input`
- `name` (string, required): Field identifier.
- `action` (string): Custom action ID override. Default: `input_change`.
- `value` (string): Current value.
- `placeholder` (string): Helper text.
- `type` (enum): `text`, `password`, `number`, `email`, `url`, `tel`, `date`, `time`.
- `trigger` (enum): `blur`, `change`. When to emit the event.
- `disabled` (boolean): Disable interaction.
- `error` (boolean | string): Error state; if string, displays as error message.

### `switch`
- `name` (string, required): Field identifier.
- `label` (string): Display label.
- `checked` (boolean): Checked state.
- `disabled` (boolean): Disable interaction.
- `action` (string): Event ID to emit on toggle.

### `select`
- `name` (string, required): Field identifier.
- `options` (array, required): Array of `{ label, value }`.
- `value` (string): Selected value.
- `placeholder` (string): Placeholder text.
- `disabled` (boolean): Disable interaction.
- `action` (string): Event ID to emit on selection.

### `checkbox`
- `name` (string, required): Field identifier.
- `label` (string): Display label.
- `checked` (boolean): Checked state.
- `disabled` (boolean): Disable interaction.
- `action` (string): Event ID to emit on toggle.

### `radiogroup`
- `name` (string, required): Field identifier.
- `options` (array, required): Array of `{ label, value }`.
- `value` (string): Selected value.
- `disabled` (boolean): Disable interaction.
- `action` (string): Event ID to emit on change.

### `icon`
- `name` (string): Icon name. Lucide by default (e.g., `shield`), or Carbon with `carbon:` prefix (e.g., `carbon:chip`).
- `size` (number|string): Lucide accepts string tokens (`sm`, `md`, `lg`) or number px. Carbon accepts ONLY numeric px (16, 20, 24, 32).
- `color` (string): CSS color.

### `slider`
- `name` (string, required): Field identifier.
- `action` (string): Custom action ID override. Default: `input_change`.
- `min` (number): Minimum value.
- `max` (number): Maximum value.
- `step` (number): Step increment.
- `value` (number): Current value. Strongly recommended; without it, the slider thumb is not rendered.
- `disabled` (boolean): Disable interaction.

### `badge`
- **`label`** (string, **REQUIRED**): Display text.
- `name` (string): Identifier sent in `remove_badge` event payload.
- `action` (string): Custom action ID override. Default: `remove_badge`.
- `variant` (enum): `solid`, `outline`, `ghost`. Visual style only (not semantic color).
- `color` (string): `primary` (default) or a CSS color string.
- `removable` (boolean): If true, shows a remove button and emits `remove_badge` event.

### `codeeditor`
- `name` (string, required): Field identifier.
- `action` (string): Custom action ID override. Default: `input_change`.
- `value` (string): Editor content.
- `language` (string): Syntax highlighting language.
- `readOnly` (boolean): Read-only mode.
- `height` (string|number): Editor height.

### `avatar`
- `src` (string): Image source URL.
- `alt` (string): Alt text.
- `fallback` (string): Text to show if image fails (e.g., initials).
- `size` (enum): `sm`, `md`, `lg`, `xl`.
- `shape` (enum): `circle`, `square`, `rounded`.
- `status` (enum): `online`, `offline`, `busy`, `away`. Shows a status dot indicator.

### `textarea`
- `name` (string, required): Field identifier.
- `action` (string): Custom action ID override. Default: `input_change`.
- `value` (string): Current value.
- `placeholder` (string): Placeholder text.
- `rows` (number): Initial visible lines.
- `maxLength` (number): Max characters allowed.
- `disabled` (boolean): Disable interaction.
- `readOnly` (boolean): Read-only mode.
- `error` (boolean | string): Error state; if string, displays as error message.
- `trigger` (enum): `blur`, `change`.

### `spinner`
- `size` (enum): `sm`, `md`, `lg`.
- `label` (string): Optional text label (usually hidden/a11y).

### `link`
- **`label`** (string, **REQUIRED**): Display text.
- `href` (string): External URL to open (using Tauri opener plugin).
- `action` (string): Event ID to emit on click.
- `disabled` (boolean): Disable interaction.

### `markdown`
- **`content`** (string, **REQUIRED**): Markdown content to render.
- Renders sanitized markdown using react-markdown + rehype-sanitize.

### `terminal`
- **`lines`** (array of strings, **REQUIRED**): Terminal output lines.
- `autoScroll` (boolean): Auto-scroll to bottom on new lines (default: true).
- Supports ANSI color codes via ansi-to-html.

### `chart`
- **`variant`** (enum, **REQUIRED**): `line`, `bar`, `pie`, `area`.
- **`data`** (array, **REQUIRED**): Array of flat objects (rows). Keys are column names. Values must be string or number.
- `xKey` (string): X-axis category key (line/bar/area). Auto-inferred: first string-typed key.
- `series` (string[]): Y-axis series keys (line/bar/area). Auto-inferred: all numeric keys.
- `labelKey` (string): Pie slice label key. Auto-inferred: first string-typed key.
- `valueKey` (string): Pie slice value key. Auto-inferred: first numeric key.
- `stacked` (boolean): Stack series (bar/area).
- `horizontal` (boolean): Horizontal bars (bar only).
- `donut` (boolean): Donut mode (pie only, inner radius 0.5).
- `xLabel` (string): X-axis label.
- `yLabel` (string): Y-axis label.
- `height` (number|string): Chart height. Default: 300px.
- `colors` (string[]): Custom color palette override.
- `showLegend` (boolean): Show legend (default: true if 2+ series).
- `showGrid` (boolean): Show grid (default: true, cartesian only).
- `showTooltip` (boolean): Show tooltips (default: true).
- `animate` (boolean): Enable animations (default: true).
- `_style` (object): Escape hatch for container styling.

## 5. Event Protocol

Events are emitted to the host system.

**Structure:**
```json
{
  "action": "submit_action",
  "payload": {
    "action": "ACTION_ID",
    "payload": {
      "kind": "input_change",
      "name": "field_name",
      "value": "field_value"
    }
  }
}
```

### 5.1 `kind` vs `action` Semantics

- **`kind`** (string, required in all typed payloads): Identifies the **event type**. Always matches the default action constant (e.g., `input_change`, `switch_change`), even when `action` is overridden. Used for event type identification.
- **`action`** (string): Identifies the **routing destination**. Defaults to the event type constant but can be overridden via the component's `action` prop for custom routing.

Example: an input with `action: "update_username"` emits:
```json
{
  "action": "submit_action",
  "payload": {
    "action": "update_username",
    "payload": { "kind": "input_change", "name": "username", "value": "souta" }
  }
}
```

### 5.2 Event Types

| Event Kind | Default Action | Emitted By | Payload Fields |
|------------|---------------|------------|----------------|
| `input_change` | `input_change` | input, textarea, codeeditor, slider, checkbox, radiogroup | `kind`, `name`, `value` |
| `switch_change` | `switch_change` | switch | `kind`, `name`, `value` (boolean) |
| `select_change` | `select_change` | select | `kind`, `name`, `value` |
| `remove_badge` | `remove_badge` | badge (when removable) | `kind`, `name` (optional), `value` (label) |
| `link_navigate` | `link_navigate` | link | `kind`, `href` |
| *(generic)* | *(custom)* | button | `action`, `payload: {}` |

**Note (Backend Injection):**
- The backend always injects `_eidou_widget_instance_id` into the outbound user event payload.
- If the submitted payload is not an object, it is wrapped as:
  `{ "value": <payload>, "_eidou_widget_instance_id": "..." }`.

### 5.3 System Diagnostic Events

The backend may emit diagnostic events to the frontend.

- **Event:** `eidou/system/diagnostic`
- **Payload:**
  ```json
  {
    "kind": "error" | "warning" | "info",
    "message": "Human readable message",
    "context": { ... } // Optional debugging context
  }
  ```
- **Behavior:** The frontend should log these to the console (e.g., `console.warn`) but must not crash or block the UI.

## 6. Minimal Example

```json
{
  "type": "projection",
  "props": {
    "title": "Minimal Widget",
    "size": "sm"
  },
  "children": [
    {
      "type": "field",
      "props": { "label": "Main Layout" },
      "children": [
        {
          "type": "col",
          "props": { "gap": 4 },
          "children": [
            {
              "type": "text",
              "props": { "content": "Hello World", "variant": "h2" }
            },
            {
              "type": "button",
              "props": {
                "label": "Click Me",
                "action": "hello_click",
                "variant": "primary"
              }
            }
          ]
        }
      ]
    }
  ]
}
```
