# Eidou Component Standards v1.1

> **Authority:** This document is the canonical reference for all frontend component
> implementation in Eidou. If `/src/AGENTS.md` conflicts with this document,
> this document wins for component-level decisions.

**Scope:** `/src/components/atoms/`, `/src/components/layouts/`
**Maintained by:** Meowfia

---

## 1. Component Categories

Eidou components fall into three tiers:

| Tier | Directory | Examples | Description |
|------|-----------|----------|-------------|
| **Atom** | `/src/components/atoms/` | Button, Input, Switch | Leaf-level UI primitives. Render EUIP atom types. |
| **Layout** | `/src/components/layouts/` | Flex, Stack, Box, Projection | Structural containers. Arrange children spatially. |
| **System** | `/src/components/system/`, `/src/components/providers/` | ErrorBoundary, ThemeProvider | Infrastructure. Not directly rendered by EUIP. |

Rules in this document apply to **Atom** and **Layout** tiers unless stated otherwise.

---

## 2. Component Declaration

### 2.1 Use `forwardRef` for All UI Components

Every Atom and Layout component MUST use `React.forwardRef`.

**Rationale:**
- Radix UI primitives require ref forwarding for positioning (Tooltip, Popover).
- ProjectionEngine may need DOM measurement on any component.
- Consistent API -- callers never need to guess whether ref works.

```tsx
// Correct
import React, { forwardRef } from 'react';

interface ButtonProps { /* ... */ }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  // ...
  return <button ref={ref} />;
});

Button.displayName = "Button";
```

**Exception:** System-tier components (ErrorBoundary, ThemeProvider) may use `React.FC`
or class components as appropriate.

### 2.2 displayName

Every component exported with `forwardRef` MUST set `displayName`.
This ensures readable React DevTools and error messages.

```tsx
export const MyComponent = forwardRef<HTMLDivElement, Props>((props, ref) => {
  // ...
});

MyComponent.displayName = "MyComponent";
```

### 2.3 Single Export Per File

Each component file MUST have exactly one primary component export.
Helper sub-components used only within that file are fine as unexported
`const` declarations.

---

## 3. Props Interface

### 3.1 Universal Base Props

Every Atom and Layout component MUST accept these base props:

```tsx
// These props are expected on ALL UI components.
// Components MAY omit props that are semantically meaningless
// (e.g., a Spacer does not need `disabled`).
interface UniversalAtomBase {
  className?: string;            // Tailwind class merge (via cn())
  style?: React.CSSProperties;  // Escape hatch for dynamic inline styles
}
```

Interactive atoms (those that emit events) MUST additionally accept:

```tsx
interface InteractiveAtomBase extends UniversalAtomBase {
  name: string;       // Field identifier for event payloads
  disabled?: boolean; // Disables interaction and applies visual dim
  action?: string;    // Override the default USER_ACTION_ID
}
```

### 3.2 Props Interface Naming

Props interfaces MUST be named `{ComponentName}Props` and placed in the
same file, directly above the component.

```tsx
interface SliderProps extends UniversalAtomBase {
  value: number;
  min?: number;
  max?: number;
  // ...
}
```

### 3.3 Default Values

Document defaults via destructuring assignment, not via `defaultProps`.

```tsx
// Correct
export const Slider = forwardRef<HTMLDivElement, SliderProps>(({
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  // ...
}, ref) => { /* ... */ });

// Incorrect -- do not use defaultProps
Slider.defaultProps = { min: 0 };
```

### 3.4 `_style` vs `style`

Two different style escape hatches exist in Eidou:

| Prop | Used By | Type | Purpose |
|------|---------|------|---------|
| `_style` | Layouts + Passive display atoms (`text`, `divider`) | `Record<string, string \| number>` | EUIP protocol escape hatch. The underscore prefix signals "use sparingly" to agents/MCP clients. |
| `style` | Interactive & visual atoms (`button`, `input`, `badge`, `avatar`, `image`, ...) | `React.CSSProperties` | Standard React inline style |

**Design Intent:** `_style` is the EUIP protocol-level escape hatch, deliberately
underscore-prefixed to discourage agents from casually injecting complex inline
styles that could break layouts. It is used by all Layouts (which agents style most
often via EUIP) and by passive display atoms (`text`, `divider`) that are also
heavily styled through the protocol pipeline.

Interactive atoms use standard React `style` because they are less commonly
styled by agents (agents typically set functional props like `label`, `action`,
`disabled`) and because their React implementations benefit from standard
`CSSProperties` typing.

**Rules:**
- Layouts and `text`/`divider` extend `UniversalStyleProps` from `/src/lib/euip.ts` and use `_style`.
- All other atoms use standard React `style`.
- Do not add both `_style` and `style` to the same component.
- Components that accept neither (`field`, `shard`, `spacer`, `icon`, `tooltip`, `toast`) are styled only through semantic props or have no styling API.

---

## 4. Event Handling (Action Protocol)

### 4.1 Event Flow

All user interactions MUST follow this flow:

```
User Action -> Optimistic UI Update -> emitUserEvent(action, payload) -> Backend ACK
```

Components MUST NOT call Tauri APIs directly. All communication goes through
`emitUserEvent()` from `/src/lib/events.ts`.

### 4.2 The `action` Prop

Every interactive atom MUST support an `action` prop that overrides the
default action ID.

```tsx
const handleChange = (newValue: boolean) => {
  if (disabled) return;
  setLocalValue(newValue); // Optimistic update

  const actionId = action || USER_ACTION_IDS.SWITCH_CHANGE;
  emitUserEvent(actionId, {
    kind: USER_ACTION_IDS.SWITCH_CHANGE,  // Always include original kind
    name,
    value: newValue,
  });
};
```

**Anti-pattern: `if/else` branching on `action`.** Do NOT split the emit
into two code paths. This causes the `kind` field to be omitted on the
default path:

```tsx
// WRONG -- causes inconsistent payload
if (action) {
  emitUserEvent(action, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value });
} else {
  emitUserEvent(USER_ACTION_IDS.INPUT_CHANGE, { name, value }); // Missing kind!
}

// CORRECT -- single path, always includes kind
const actionId = action || USER_ACTION_IDS.INPUT_CHANGE;
emitUserEvent(actionId, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value });
```

### 4.3 Unified Payload Format

All event payloads MUST follow this structure:

```tsx
interface ActionPayload {
  kind: string;   // The canonical action type (e.g., 'input_change')
  name: string;   // Field identifier
  value: unknown;  // The new value
}
```

**Rule:** `kind` is ALWAYS the component's canonical action ID from
`USER_ACTION_IDS`, regardless of whether `action` prop overrides the
emitted action string. This lets the backend know the _semantic intent_
even when receiving a custom action ID.

**Rule:** `kind` MUST be present in EVERY event payload. No exceptions.
This includes payloads emitted by hooks (`useCommittedTextInput`).

### 4.4 Action ID Registry

All action IDs MUST be defined in `/src/lib/protocol.ts`. Components MUST
NOT use string literals for action IDs.

```tsx
// Correct
emitUserEvent(USER_ACTION_IDS.INPUT_CHANGE, payload);

// Incorrect
emitUserEvent('input_change', payload);
```

### 4.5 Hook Integration with Action Protocol

`useCommittedTextInput` MUST include `kind` in its emitted payload and
accept an `actionId` parameter so components can pass their resolved
`action` prop:

```tsx
const { localValue, onChange, onBlurCommit, onEnterCommit } = useCommittedTextInput({
  name,
  value,
  trigger,
  actionId: action || USER_ACTION_IDS.INPUT_CHANGE,  // Pass resolved action
});
// The hook internally emits:
// emitUserEvent(actionId, { kind: USER_ACTION_IDS.INPUT_CHANGE, name, value })
```

---

## 5. Styling Rules

### 5.1 V4 Design System Compliance (Tactical Terminal)

| Property | Rule | Allowed Exceptions |
|----------|------|--------------------|
| Border radius | `rounded-none` everywhere | None. V4 is absolute: zero radius on ALL elements. |
| Transitions | `duration-100` for all interactive transitions | Animation keyframes (materialization) may use longer durations |
| Colors | Use design tokens only (`text-primary`, `bg-card`, etc.) | Custom colors only via ThemeProvider overrides |
| Font | `font-mono` for data/code, `font-sans` for body, `font-heading` for titles | -- |

### 5.2 Semantic Style Helpers

Layout components MUST use `getUniversalLayoutClasses()` from
`/src/lib/semantic-styles.ts` for shared styling props (padding, margin,
border, background, radius, shadow).

```tsx
// Correct -- use the universal helper
import { getUniversalLayoutClasses } from '../../lib/semantic-styles';

const universalClasses = getUniversalLayoutClasses(layoutProps);

// Incorrect -- manually calling individual helpers when universal exists
const classes = cn(
  getSpacingClass('p', p),
  getSpacingClass('px', px),
  getBgClass(bg, bgOpacity),
  border && "border",
  // ... repeating the same pattern
);
```

Atoms that need individual style helpers (e.g., Text using `getTextSizeClass`)
may call them directly since `getUniversalLayoutClasses` is layout-specific.

### 5.3 Class Composition

Use the `cn()` utility from `/src/lib/utils.ts` for all className merging.
Never concatenate class strings manually.

```tsx
// Correct
className={cn("base-classes", conditional && "conditional-class", className)}

// Incorrect
className={`base-classes ${conditional ? 'conditional-class' : ''} ${className}`}
```

---

## 6. State Management

### 6.1 Server-Authoritative Model

Eidou is a **dumb terminal**. All real state lives in the MCP backend.
Components maintain only transient/optimistic local state.

**Server Push Override:** When the backend sends a new prop value (via
re-render), the component MUST accept it unconditionally and overwrite
local state. The backend is authoritative. Components MUST NOT attempt
to "protect" local dirty state against server pushes.

### 6.2 Component State Categories

Interactive atoms fall into four categories based on their state needs:

| Category | Components | Required Hook | Emit Timing |
|----------|-----------|---------------|-------------|
| **Fire-and-forget** | Button | None | On click (stateless) |
| **Toggle / Selection** | Switch, Checkbox, RadioGroup, Select, Slider | `useSyncedState` | On change (immediate) |
| **Text Input** | Input, Textarea, CodeEditor | `useCommittedTextInput` | On blur / enter / debounce |
| **Presentational + Action** | Badge (removable) | None | On click (stateless) |

**Rules:**

- Toggle / Selection components MUST use `useSyncedState`. This ensures
  instant visual feedback on interaction and automatic sync on server push.
- Text Input components MUST use `useCommittedTextInput`. This ensures
  smooth typing without per-keystroke IPC and consistent commit behavior.
- Fire-and-forget and Presentational components have no local value state.

### 6.3 `useSyncedState`

Maintains local state that automatically syncs with a server-authoritative prop.

```tsx
import { useSyncedState } from '../../lib/hooks/useSyncedState';

const [localValue, setLocalValue] = useSyncedState(propValue);
```

Use for: Switch, Checkbox, RadioGroup, Select, Slider.

### 6.4 `useCommittedTextInput`

Manages text input with debounced or blur-committed event emission.

```tsx
import { useCommittedTextInput } from '../../lib/hooks/useCommittedTextInput';

const { localValue, onChange, onBlurCommit, onEnterCommit } = useCommittedTextInput({
  name,
  value,
  trigger,   // 'blur' | 'change'
  actionId,  // Pass component's resolved action ID (action || default)
});
```

Use for: Input, Textarea, CodeEditor.

**Integration with Action Protocol:** The hook MUST include `kind` in its
emitted payload (see Section 4.5). Components pass their resolved `actionId`
(which may be overridden by the `action` prop) to the hook.

### 6.5 Server Push Behavior

When the backend pushes a new render (e.g., `eidou:render`):

- `useSyncedState`: overwrites local state with new prop value.
- `useCommittedTextInput`: overwrites `localValue` with new `value` prop.

This is correct behavior for Eidou's "show_widget_and_wait" pattern where
the backend does not re-render while waiting for user input. If a future
use case requires live server updates while the user is editing, the hooks
can be extended with a dirty-check guard. Because all components use the
shared hooks, such a change would propagate automatically.

---

## 7. File Organization

### 7.1 Simple Components (Under 200 Lines)

A single file is fine:

```
src/components/atoms/Button.tsx     (65 lines -- no split needed)
```

### 7.2 Complex Components (Over 200 Lines)

When a component file exceeds **200 lines**, it SHOULD be evaluated for
splitting. When it exceeds **300 lines**, splitting is REQUIRED.

**Split into a directory with collocated files:**

```
src/components/layouts/Projection/
  index.tsx                   -- Public export (re-exports main component)
  Projection.tsx              -- Main component (render logic)
  ProjectionChrome.tsx        -- Sub-component: window chrome/frame
  useProjectionAnimation.ts   -- Hook: animation/materialization state
  useProjectionResize.ts      -- Hook: resize + size constraints
  Projection.test.tsx         -- Tests
```

**Rules for splitting:**

- **index.tsx** re-exports the main component: `export { Projection } from './Projection';`
- **Hooks** extract stateful logic (useEffect, useState, useCallback).
- **Sub-components** extract visual sections of the JSX tree.
- **No orphan files**: every file in the directory must be used by the main component.
- **Import rule**: sub-components and hooks MUST NOT import from each other
  circularly. Dependency flows from main component downward.

### 7.3 Test Collocation

Test files live alongside their component:

```
src/components/atoms/Button.tsx
src/components/atoms/Button.test.tsx

src/components/layouts/Projection/
  Projection.tsx
  Projection.test.tsx
```

---

## 8. Accessibility

### 8.1 Label Association

Interactive elements with visible labels MUST use `htmlFor`/`id` association:

```tsx
<SwitchPrimitive.Root id={name} /* ... */ />
{label && <label htmlFor={name}>{label}</label>}
```

### 8.2 ARIA Attributes

- Buttons: rely on native `<button>` semantics.
- Status indicators: use `role="status"` and `aria-label`.
- Error displays: use `role="alert"` and `aria-live="assertive"`.
- Toggle controls: Radix primitives handle `aria-checked` automatically.

### 8.3 Keyboard Navigation

All interactive atoms MUST be keyboard-accessible. Radix primitives handle
this automatically. Custom interactive elements must handle Enter/Space.

---

## 9. Security

### 9.1 No Direct Tauri API Calls in Components

Components MUST NOT import from `@tauri-apps/*` packages.

**Allowed locations for Tauri imports:**
- `/src/lib/events.ts` (invoke for submit_action)
- `/src/App.tsx` (window lifecycle)
- `/src/components/layouts/Projection.tsx` (window management -- to be refactored)

If a component needs platform capabilities (e.g., opening a URL), it MUST
route through `emitUserEvent` or a dedicated `/src/lib/` abstraction.

### 9.2 No `dangerouslySetInnerHTML`

Avoid `dangerouslySetInnerHTML` unless absolutely necessary (e.g., Terminal ANSI
rendering). When used:
- The input MUST be sanitized.
- Document the security rationale inline.
- The ProjectionEngine strips `dangerouslySetInnerHTML` from EUIP props as a safety net.

---

## 10. Type Safety

### 10.1 No `any`

As per `/src/AGENTS.md`: no `any` in source code. Use `unknown` with narrowing,
or define explicit types.

### 10.2 Event Payload Typing

Event payloads MUST be typed. The `emitUserEvent` function should accept
`Record<string, unknown>` (not `Record<string, any>`).

### 10.3 Index Signatures

Avoid `[key: string]: T` index signatures in interface definitions.
Use explicit optional properties or `Partial<Record<KnownKey, T>>`.

---

## 11. Reference: Component Anatomy (Canonical Example)

Below is the canonical structure for an interactive atom:

```tsx
import React, { forwardRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';
import { emitUserEvent } from '../../lib/events';
import { USER_ACTION_IDS } from '../../lib/protocol';
import { useSyncedState } from '../../lib/hooks/useSyncedState';

// -- 1. Props Interface --
interface SwitchProps {
  // Identity
  name: string;
  label?: string;

  // State
  checked?: boolean;
  disabled?: boolean;

  // Event override
  action?: string;

  // Universal base
  className?: string;
  style?: React.CSSProperties;
}

// -- 2. Component (forwardRef) --
export const Switch = forwardRef<HTMLDivElement, SwitchProps>(({
  name,
  label,
  checked: propChecked = false,
  disabled = false,
  action,
  className,
  style,
}, ref) => {
  // -- 3. Synced state --
  const [checked, setChecked] = useSyncedState(propChecked);

  // -- 4. Event handler (unified payload, single-path emit) --
  const handleCheckedChange = (newChecked: boolean) => {
    if (disabled) return;
    setChecked(newChecked);

    const actionId = action || USER_ACTION_IDS.SWITCH_CHANGE;
    emitUserEvent(actionId, {
      kind: USER_ACTION_IDS.SWITCH_CHANGE,
      name,
      value: newChecked,
    });
  };

  // -- 5. Render --
  return (
    <div ref={ref} className={cn("flex items-center gap-3", className)} style={style}>
      <SwitchPrimitive.Root
        id={name}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        className="w-[42px] h-[25px] rounded-none ..."
      >
        <SwitchPrimitive.Thumb className="block w-[21px] h-[21px] rounded-none ..." />
      </SwitchPrimitive.Root>
      {label && (
        <label htmlFor={name} className="text-foreground font-mono text-sm select-none">
          {label}
        </label>
      )}
    </div>
  );
});

// -- 6. displayName --
Switch.displayName = "Switch";
```

---

## Changelog

### v1.1 (2026-02-08)
- Section 4.2: Added anti-pattern for `if/else` action branching.
- Section 4.3: Strengthened `kind` requirement (MUST be in every payload).
- Section 4.5: New section on hook integration with action protocol.
- Section 6: Complete rewrite with state categories, hook requirements,
  and server push behavior documentation.
- Section 11: Added Radix import to canonical example.

### v1.0 (2026-02-08)
- Initial version. Codified from frontend audit findings.
- Covers: declaration, props, events, styling, file org, a11y, security, types.
