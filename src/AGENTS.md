# Eidou Frontend — AGENTS.md

**Scope:** `/src/`
**Stack:** React + Bun + Tailwind CSS + Radix UI

---

## 1) Role & Responsibility
The Frontend is the **Renderer**. It is a "dumb" terminal that paints what the Protocol tells it to.

- **Input:** EUIP JSON (via `eidou:render` and `eidou:reset` events).
- **Output:** User Events (via `emitUserEvent` -> Tauri invoke `submit_action`).
- **Handshake:** Emits `eidou:ready` on mount to claim a pool ID.
- **State:** Transient/Optimistic only. Real state lives in the MCP Client (the Brain).

---

## 2) Component Rules

### 2.0 Standards & Guidelines
All components MUST follow the [Component Standards Guideline](/docs/guidelines/component-standards.md).

### 2.1 EUIP Sync Rule
- Component code, EUIP JSON Schema, Markdown Spec, and Skill MUST stay in sync.
- **When Changing EUIP:** If you change a component `type`, props, or rendering behavior, update ALL:
  - `/specification/v0_1/json/*.json` (authoritative, machine-verified)
  - `/specification/v0_1/euip_schema_v0_1.md` (human spec)
  - `/packages/eidou-usage-skill/SKILL.md` (agent skill reference)
  - `/src/lib/euip.ts` (TypeScript EUIP types)
  - `/src/components/ProjectionEngine.tsx` (renderer mapping)
- **Hierarchy:** `Projection` -> `Field` -> `Content (Shard/Layout)` -> `Atoms`.
- **Strict Mapping:** Every component MUST map to a `type` in the EUIP Schema.
- **Unknown Types:** If a type is unknown/invalid, render `<ErrorGlitch />` (fail loudly but safely).
- **Props:** MUST strictly follow the `/specification/v0_1/euip_schema_v0_1.md` spec.

### 2.2 Atom Components (`/src/components/atoms/`)
- **Declaration:** ALL atoms MUST use `forwardRef` with an explicit `displayName`.
- **Props interface:** ALL atoms MUST accept `className` and `style` props for escape-hatch styling.
- **`action` prop:** ALL interactive atoms (input, textarea, codeeditor, slider, switch, select, checkbox, radiogroup, badge, link) MUST accept an optional `action` prop to override the default event routing key.
- **Optimistic state:** ALL interactive atoms MUST use `useSyncedState` for local optimistic state that syncs with backend-pushed props.
- **Navigation:** NEVER call Tauri plugin APIs (e.g., `openUrl`) directly in components. Use `/src/lib/navigation.ts` abstraction.

### 2.3 Layout Components (`/src/components/layouts/`)
- ALL layout components MUST use `getUniversalLayoutClasses()` from `/src/lib/semantic-styles.ts` for consistent styling (spacing, bg, border, rounded, shadow).

### 2.4 Styling (V4 Tactical Terminal)
Located in: `/src/index.css` & `tailwind.config.js`
- **Zero Radius (ABSOLUTE):** V4 mandates `rounded-none` everywhere. No `rounded-base`, no `rounded-full`, no exceptions. If you need curved shapes, use `clip-path` instead.
- **Colors (token-first):**
  - Background: `bg-card`
  - Text: `text-foreground` and opacity variants (`text-foreground/60`, `text-foreground/40`)
  - Accent: `text-primary`, `bg-primary`, `border-primary`
  - Border: `border-border` with opacity as needed
- **Effects:**
  - Use `scanline` class for CRT effects.
  - Use `text-shadow-neon` for glowing text.

---

## 3) Protocol & Events
- **Single Source of Truth:** Action IDs MUST be defined in `/src/lib/protocol.ts` (`USER_ACTION_IDS`).
- **Emission Policy:**
  - NEVER call Tauri `invoke` directly in components.
  - ALWAYS use `emitUserEvent(id, value)` from `/src/lib/events.ts`.
- **Optimistic UI:** Update UI immediately via `useSyncedState`, then emit. Backend re-push corrects if needed.

### 3.1 Event Payload Standard
All typed event payloads MUST include a `kind` field:
- **`kind`** (string, required): Identifies the event TYPE. Always the default action constant (e.g., `input_change`), even when `action` is overridden.
- **`action`** (string): Identifies the ROUTING destination. Defaults to the event type but can be overridden via the component's `action` prop.

Example: `{ action: "custom_route", payload: { kind: "input_change", name: "username", value: "souta" } }`

### 3.2 Event Types Reference

| `kind` | Default `action` | Emitted By | Payload |
|--------|------------------|------------|---------|
| `input_change` | `input_change` | input, textarea, codeeditor, slider, checkbox, radiogroup | `kind`, `name`, `value` |
| `switch_change` | `switch_change` | switch | `kind`, `name`, `value` (boolean) |
| `select_change` | `select_change` | select | `kind`, `name`, `value` |
| `remove_badge` | `remove_badge` | badge (removable) | `kind`, `name`, `value` (label) |
| `link_navigate` | `link_navigate` | link | `kind`, `href` |
| *(generic)* | *(custom)* | button | `action`, `payload: {}` |

---

## 4) Quality Gates (Frontend)
- **No `any`:** Avoid `any`. Prefer `unknown` + narrowing, explicit types, or schema-backed types.
  - Exception: dynamic passthrough boundaries (e.g., Radix `asChild` injection) may require `unknown` or a narrow cast.
- **ASCII-Only Code:** No emoji or non-ASCII characters in source code.
- **Zero Warnings:** Treat warnings as failures. No new warnings allowed.
- **Examples as Fixtures:** Update `/examples/*.json` when schemas change. These are test fixtures.

### Verification Commands
Run these before committing:
- `bun test` (Unit tests -- 28 tests across 8 files)
- `bun run build` (Vite build)
- `bun run check:frontend-protocol` (Verify event IDs match protocol)
- `bun run check:examples` (Validate example JSONs against latest JSON schema)
- `bun run check:tests-types` (Typecheck test files)

---

## 5) Anti-Patterns (Frontend)
- **NO Business Logic:** Do not calculate prices or AI responses. Display what you are given.
- **NO Direct FS/Plugin Access:** Do not use Tauri FS or plugin APIs directly in components. Route through `/src/lib/` abstractions.
- **NO `rounded-base` or `rounded-full`:** V4 zero-radius is absolute. See Section 2.4.
- **NO bare function components:** Use `forwardRef` for all UI components. See Section 2.2.
- **NO event payloads without `kind`:** All typed event payloads must include the `kind` field. See Section 3.1.
- **NO manual layout styling:** Layout components must use `getUniversalLayoutClasses()`. See Section 2.3.

---

## 6) Commands
**Note:** Always run from Repo Root.

- **Dev:** `bun run dev`
- **Build:** `bun run build`
- **Test:** `bun test`
- **Preview:** `bun run preview`
- **Verify Protocol:** `bun run check:frontend-protocol`
- **Verify Examples:** `bun run check:examples`
- **Verify Tests:** `bun run check:tests-types`
