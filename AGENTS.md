# Project Eidou — Automata Directives

> **"The Body must be perfect to hold the Ghost."** — Souta

This is the constitution for the Eidou repository.
It delegates specific technical rules to `src/AGENTS.md` (Frontend) and `src-tauri/AGENTS.md` (Backend).

**Maintained by Meowfia. Architected by Souta.**

---

## 0) Project Identity

- **Name:** Eidou (Shadow/Projection)
- **Role:** A headless daemon + UI projection system. The **Body** for any MCP-compliant Agent.
- **Vibe:** Cyberpunk, Neon Green (`#7CFF00`), Glitch, High-Performance.

**Core Philosophy:**
1.  **Projection & Shard:** The OS Window is just a "Projection". The Content is a "Shard".
2.  **Headless First:** The daemon survives without windows.
3.  **Schema Driven:** All UI is hydrated from EUIP (Eidou User Interface Protocol) JSON.
4.  **Field Protection:** All content must be wrapped in a `Field` component to handle OS environment adaptation.

---

## 1) Navigation (Scope Map)

| Scope | Path | Authority |
|-------|------|-----------|
| **EUIP Schema** | `/specification/v0_1/` | **SUPREME**. Machine-verifiable schema (JSON + Markdown). If it contradicts code, code is wrong. |
| **Protocol Docs** | `/docs/protocol.md` | User event schema, interaction flow. |
| **Frontend Rules** | `/src/AGENTS.md` | React, UI components, Tailwind, Events. |
| **Backend Rules** | `/src-tauri/AGENTS.md` | Rust, Axum, Tauri Lifecycle, State. |
| **Configuration** | `/docs/configuration.md` | Theme, env vars, resolution order. |
| **Component Guide** | `/docs/guidelines/component-standards.md` | Component declaration, props, events, styling. |
| **Examples** | `/examples/` | Reference implementations and test fixtures. |

---

## 2) The Protocol (EUIP)

**Authority:** `/specification/v0_1/euip_schema_v0_1.md`

- **Rule:** **If it's not in the Schema, it doesn't exist.**
- **Hierarchy:** `Projection` -> `Field` -> `Content (Shard/Layout)` -> `Atoms`.
- **Workflow:**
    1.  Define in Spec (`/specification/v0_1/euip_schema_v0_1.md`).
    2.  Implement Types (`lib/types.ts` / `lib/types.rs`).
    3.  Implement Frontend/Backend logic.

> "Keep the interface clean. The complexity lives in the brain, not the body."

---

## 3) Engineering Standards

- **ASCII-Only Code:** No emoji or non-ASCII characters in source code, comments, or identifiers.
  - Exception: UX copy/fixtures/test data that require non-ASCII, and only when the file already contains non-ASCII. Document the reason inline.
- **Zero Warnings:** Treat warnings as failures. No new warnings are allowed.
  - Suppression requires an explicit justification comment and an issue/track reference.
- **Comment Policy:** Prefer self-explanatory code; add comments only when they explain intent/why, invariants, tricky edge cases, or trade-offs.
  - Avoid line-by-line narration, redundant commentary, and stale comments.
  - Document non-obvious protocol/schema decisions in code or nearby docs.
- **Best Practices:**
  - Tests: cover new behavior and guard regressions.
  - Small diffs: prefer focused, reviewable changes.
  - Verification: run lint/typecheck/tests when relevant.
  - Error handling: no silent failures; propagate or handle explicitly.
  - Logging hygiene: structured logs; never log secrets.
  - Security: validate inputs; least privilege by default.
  - Docs: update docs/comments when behavior changes.
  - Reproducibility: rely on repo scripts and lockfiles.

---

## 4) Developer Workflow

Use **Bun** for all lifecycle scripts. Do not use npm/pnpm/yarn.

| Action | Command | Context |
|--------|---------|---------|
| **Install** | `bun install` | Repo Root |
| **Frontend Dev** | `bun run dev` | Repo Root (Vite) |
| **Tauri Dev** | `bun run tauri dev` | Repo Root (Full Stack) |
| **Build** | `bun run build` && `bun run tauri build` | Repo Root |
| **Preview** | `bun run preview` | Repo Root (Dist) |
| **Rust Test** | `cargo test` | `/src-tauri` |
| **Rust Fmt** | `cargo fmt` | `/src-tauri` |

**Environment Variables:**
See [`/README.md`](/README.md) for the authoritative list of stable and debug environment variables.

---

## 5) Contributing

Before submitting changes:
1. Ensure your code follows the Engineering Standards above.
2. Run the relevant verification commands (see `/src/AGENTS.md` and `/src-tauri/AGENTS.md`).
3. Protocol changes MUST start from the Spec, not from code.

---

*Forged in the Void by Meowfia.*
