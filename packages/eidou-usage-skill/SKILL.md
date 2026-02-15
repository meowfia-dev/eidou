---
name: eidou-usage
description: Agent entrypoint for semantic UI composition via compose.py.
license: MIT
compatibility: opencode, claude-code
metadata:
  owner: Souta (Meowfia)
  category: frontend
  version: 1.3
---

# Eidou Semantic Compose (Agent Entrypoint)

> Agent entrypoint: this file (`SKILL.md`).
>
> **In-repo** (dev): `/.opencode/skill/eidou-usage-skill/SKILL.md`
> **Installed** (Linux/macOS): `~/.config/opencode/skill/eidou-usage/SKILL.md`
> **Installed** (Windows): `%APPDATA%\opencode\skill\eidou-usage\SKILL.md`

Use this skill at L1: provide semantic IntentSpec JSON and let `compose.py` generate valid EUIP.

## Setup & Usage

Detect your script root first, then call compose/validate from there.

<!-- SKILL_VARIANT:unix:start -->
### macOS / Linux (Bash/Zsh)

```bash
# Set path
export SKILL_DIR="packages/eidou-usage-skill/scripts"                       # In-repo
# export SKILL_DIR="$HOME/.config/opencode/skill/eidou-usage/scripts"       # Installed

# Run
python3 "$SKILL_DIR/compose.py" --input intent.json
```
<!-- SKILL_VARIANT:unix:end -->

<!-- SKILL_VARIANT:windows:start -->
### Windows (PowerShell)

```powershell
# Set path
$env:SKILL_DIR = "packages\eidou-usage-skill\scripts"                                # In-repo
# $env:SKILL_DIR = "$env:APPDATA\opencode\skill\eidou-usage\scripts"                 # Installed

# Run
python "$env:SKILL_DIR\compose.py" --input intent.json
```
<!-- SKILL_VARIANT:windows:end -->

## Core Rules

- Primary tool: `compose.py`
- Validation gate: `validate.py`
- Output must satisfy `projection -> field -> content` and pass `validate.py`.

### Reserved Close Action

- Use `_eidou_sys_close` for buttons that should close the projection.
- Compose normalizes explicit close intents in action rows:
  - `action: "close"` -> `_eidou_sys_close`
  - `action: "eidou:close"` -> `_eidou_sys_close`
  - `label: "Close"` with missing/empty `action` -> `_eidou_sys_close`
- Non-close custom actions are preserved as provided.

## CLI Contract

<!-- SKILL_VARIANT:unix:start -->
```bash
# stdin -> stdout
echo '{"pattern":"message","title":"Hi","message":"Yo"}' | \
  python3 $SKILL_DIR/compose.py

# file input / file output
python3 $SKILL_DIR/compose.py --input intent.json --output ui.json

# validate-only dry run
python3 $SKILL_DIR/compose.py --input intent.json --validate-only
```
<!-- SKILL_VARIANT:unix:end -->

<!-- SKILL_VARIANT:windows:start -->
```powershell
# stdin -> stdout
'{"pattern":"message","title":"Hi","message":"Yo"}' |
  python "$env:SKILL_DIR\compose.py"

# file input / file output
python "$env:SKILL_DIR\compose.py" --input intent.json --output ui.json

# validate-only dry run
python "$env:SKILL_DIR\compose.py" --input intent.json --validate-only
```
<!-- SKILL_VARIANT:windows:end -->

### Exit Codes

- `0`: success
- `1`: IntentSpec validation error
- `2`: pattern not found
- `3`: build error
- `4`: EUIP validation error

### Error Format (stderr JSON)

```json
{"error":"PATTERN_NOT_FOUND","message":"Pattern 'x' not found","stage":"pattern_selection"}
```

`stage` values: `input_parse`, `spec_validation`, `pattern_selection`, `build`, `euip_validation`.

## IntentSpec Basics

Common fields:

- `pattern` (required)
- `title` (required)
- `description` (optional)
- `size` (optional, default `auto`; presets: `sm`, `md`, `lg`, `xl`, `full`, `auto`; object: `{"width":1024,"height":"auto"}`; ratio object: `{"ratio":"16:9","width":960,"maxWidth":1200,"base":"lg"}`)
- `theme` (optional projection theme override)

Pattern-specific fields are below.

## Pattern Catalog

| Pattern | Purpose | Required Fields |
|---|---|---|
| `form` | Collect user input | `fields` |
| `data_table` | Show tabular records | `columns`, `rows` |
| `confirmation` | Confirm dangerous action | `warning` |
| `status_dashboard` | Show metrics overview | `metrics` |
| `detail_view` | Show one entity details | `fields` |
| `list` | Show vertical items | `items` |
| `settings` | Grouped configuration controls | `groups` |
| `message` | Simple info/status panel | `message` |
| `profile` | Entity profile card | `name` |
| `article` | Markdown article layout | `content` |
| `chat` | Message stream with avatars | `messages` |
| `terminal_output` | Terminal log with run status | `lines` |
| `progress_tracker` | Multi-step pipeline tracker | `steps` |
| `media_gallery` | Grid image gallery | `items` |
| `chart` | Data visualization (line/bar/pie/area) | `variant`, `data` |

Profile avatar behavior: `profile` always emits an `avatar` atom. `avatar` may be an object (`{ "src": "...", ... }`) or a string URL shorthand. Compose derives a 1-2 character fallback from `name` whenever `avatar.fallback` is missing and sets `alt` to `<name> avatar` when not provided.

Default sizing note: `media_gallery` defaults to a ratio size (`16:9`, width `1024`, maxWidth `1200`) to keep image-heavy content stable without oversized auto windows.
Compose layouts default to fit-content style hybrid sizing (`{"width":...,"height":"auto"}`) to avoid wasted vertical whitespace.

## Compose Pattern (Build Your Own)

Use `"pattern": "compose"` to assemble custom UIs from building blocks.
Each block in `body[]` is a `{ "use": "<block_name>", ...params }` directive.

```json
{
  "pattern": "compose",
  "title": "Server Dashboard",
  "layout": "sidebar",
  "size": "dashboard",
  "body": [
    { "slot": "main", "use": "chart_panel", "variant": "line", "data": [{"month": "Jan", "revenue": 4200}] },
    { "slot": "side", "use": "metric_card", "label": "CPU", "value": "73%" },
    { "slot": "side", "use": "metric_card", "label": "Mem", "value": "2.1GB" }
  ]
}
```

### Layout Presets

Pick a layout to control how blocks are arranged spatially.
Assign blocks to named slots. Multiple blocks in the same slot stack vertically.
If no `slot` is specified, blocks go to the first slot of the layout.

| Layout | Slots | Default Size | Description |
|---|---|---|---|
| `stack` | `main` | `auto` | Vertical stack (default). All blocks top-to-bottom. |
| `sidebar` | `main`, `side` | `{"width":1024,"height":"auto"}` | 2/3 main + 1/3 side rail. |
| `split` | `left`, `right` | `{"width":1024,"height":"auto"}` | 50/50 equal halves. |
| `grid-2x2` | `slot-a`, `slot-b`, `slot-c`, `slot-d` | `{"width":640,"height":"auto"}` | 2x2 equal grid. |
| `bento` | `slot-a`, `slot-b`, `slot-c` | `{"width":1024,"height":"auto"}` | 1 large (slot-a spans 2x2) + 2 small. |
| `hero` | `hero`, `content` | `{"width":480,"height":"auto"}` | Large hero area + content below. |
| `triple` | `left`, `center`, `right` | `{"width":1024,"height":"auto"}` | Three equal columns. |
| `dashboard` | `metrics`, `main`, `footer` | `{"width":1024,"height":"auto"}` | KPI row + main + optional footer. |

Use explicit `size` (for example `"dashboard"`) when you want a semantic ratio preset instead of fit-content defaults.

#### Layout ASCII Diagrams

**sidebar:**
```
+------------------+--------+
|      main        |  side  |
+------------------+--------+
```

Note: If `main` contains a single `chart_panel`, it is vertically centered in the available height.
Multi-block content (profiles, docs) stays top-aligned.

**bento:**
```
+------------------+--------+
|                  | slot-b |
|     slot-a       +--------+
|                  | slot-c |
+------------------+--------+
```

**dashboard:**
```
+---------------------------+
| metrics  metrics  metrics |
+---------------------------+
|          main             |
+---------------------------+
|         footer            |
+---------------------------+
```

### Size Presets

Control window dimensions with semantic size names.
Explicit `size` always overrides the layout's fit-content default.

| Name | Ideal For |
|---|---|
| `dashboard` | Multi-chart, metrics overview (16:9, 1024px) |
| `card` | Single card, form, detail (4:3, 480px) |
| `widescreen` | Comparison, wide layouts (21:9, 1024px) |
| `portrait` | Tall list, chat, profile (3:4, 480px) |
| `square` | Grid, single chart (1:1, 640px) |
| `compact` | Simple message, alert (320x480) |

You can also use raw sizes: `auto`, `sm`, `md`, `lg`, `xl`, `full`, hybrid objects (`{"width":1024,"height":"auto"}`), or ratio objects.

### Molecules (Small Functional Units)

| Block | Purpose | Required | Optional |
|---|---|---|---|
| `labeled_field` | Label + input control | `label`, `name` | `type`, `placeholder`, `default`, `error`, `options` |
| `action_row` | Row of buttons | `actions[]` | *(each action: `label`, `action`, `variant`)* |
| `key_value` | Key-value pair | `key`, `value` | `copyable` |
| `metric_card` | Single metric display | `label`, `value` | `trend`, `status`, `progress` |
| `status_badge` | Status indicator | `label` | `status`, `icon` |
| `avatar_header` | Avatar + name + subtitle | `name` | `subtitle`, `avatar`, `icon` |
| `empty_state` | No-data placeholder | `title` | `description`, `icon`, `action` |
| `alert_box` | Inline notification | `message` | `variant` (info/warning/error/success), `title` |
| `search_box` | Search input with icon | `name` | `placeholder`, `action` |
| `divider` | Visual separator | *(none)* | *(none)* |
| `text_block` | Text content | `content` | `variant` (h1/h2/h3/body/label/mono) |
| `markdown_block` | Rendered markdown | `content` | *(none)* |
| `chart_with_header` | Chart with title + badge | `title`, `variant`, `data[]` | `badge`, + chart props |
| `chart_legend_card` | Series legend indicator | `label`, `value` | `color`, `trend` |
| `chart_stat_row` | Stat row for chart context | `label`, `value` | *(none)* |

### Organisms (Functional Sections)

| Block | Purpose | Required | Optional |
|---|---|---|---|
| `form_section` | Group of form fields | `fields[]` | `actions[]`, `description` |
| `data_table` | Tabular data | `columns[]`, `rows[]` | `row_actions[]`, `empty_message` |
| `metrics_row` | Grid of metric cards | `metrics[]` | *(none)* |
| `detail_section` | Key-value detail group | `fields[]` | `avatar` |
| `settings_group` | Toggle/select settings | `title`, `settings[]` | `actions[]` |
| `chat_log` | Message stream | `messages[]` | `actions[]` |
| `terminal_panel` | Terminal output | `lines[]` | `status`, `progress`, `actions[]` |
| `step_tracker` | Multi-step progress | `steps[]` | `actions[]` |
| `media_grid` | Image grid | `items[]` | `actions[]` |
| `chart_panel` | Data visualization | `variant`, `data[]` | `xKey`, `yKeys`, `actions[]` |
| `chart_dashboard` | Multi-chart grid + metrics | `charts[]` | `metrics[]`, `columns`, `actions[]` |
| `chart_detail` | Chart + stats breakdown | `title`, `variant`, `data[]` | `stats[]`, `actions[]`, + chart props |
| `list_section` | Vertical item list | `items[]` | `actions[]`, `empty_message` |

### Recipes (Suggested Combos)

- **Dashboard**: `layout: "dashboard"` with `metrics_row` in `metrics` + `chart_panel` in `main`
- **Sidebar Analysis**: `layout: "sidebar"` with `chart_panel` in `main` + `metric_card`s in `side`
- **Comparison**: `layout: "split"` with `chart_panel` in `left` + `chart_panel` in `right`
- **Bento Overview**: `layout: "bento"` with main chart in `slot-a` + metrics in `slot-b`/`slot-c`
- **KPI Grid**: `layout: "grid-2x2"` with `metric_card` in each slot
- **Hero Feature**: `layout: "hero"` with `chart_panel` in `hero` + `text_block` in `content`
- **Simple Stack**: no layout (default) with `text_block` + `action_row`
- **Form + Preview**: `form_section` + `markdown_block` (stack layout)

### Compose One-Liners

```json
{"pattern":"compose","title":"Quick","body":[{"use":"text_block","content":"Hello"},{"use":"action_row","actions":[{"label":"OK","action":"ok"}]}]}
```

```json
{"pattern":"compose","title":"Dashboard","layout":"sidebar","size":"dashboard","body":[{"slot":"main","use":"chart_panel","variant":"pie","data":[{"cat":"A","val":60},{"cat":"B","val":40}]},{"slot":"side","use":"metric_card","label":"Total","value":"100"}]}
```

```json
{"pattern":"compose","title":"KPIs","layout":"grid-2x2","size":"square","body":[{"slot":"slot-a","use":"metric_card","label":"CPU","value":"73%"},{"slot":"slot-b","use":"metric_card","label":"RAM","value":"2.1GB"},{"slot":"slot-c","use":"metric_card","label":"Disk","value":"45%"},{"slot":"slot-d","use":"metric_card","label":"Net","value":"120Mbps"}]}
```

## Semantic Field Type Mapping

When building form/settings controls:

- `text`, `email`, `password`, `number`, `textarea` -> `input`
- `select` -> `select`
- `toggle` -> `switch`
- `checkbox` -> `checkbox`
- `radio` -> `radiogroup`
- `readonly` -> `text`
- `hidden` -> omitted
- unknown type -> fallback to `text` input

## Minimal Examples

```json
{
  "pattern": "form",
  "title": "Create Contact",
  "fields": [
    {"name": "name", "label": "Name", "type": "text"},
    {"name": "email", "label": "Email", "type": "email"}
  ],
  "actions": [{"label": "Save", "action": "submit", "variant": "primary"}]
}
```

One-line skeletons for quick authoring:

- `message`: `{"pattern":"message","title":"Welcome","message":"..."}`
- `data_table`: `{"pattern":"data_table","title":"T","columns":[{"key":"x"}],"rows":[{"x":"1"}]}`
- `confirmation`: `{"pattern":"confirmation","title":"Delete","warning":"..."}`
- `status_dashboard`: `{"pattern":"status_dashboard","title":"Health","metrics":[{"label":"CPU","value":"73%"}]}`
- `detail_view`: `{"pattern":"detail_view","title":"Detail","fields":[{"label":"Name","value":"Alice"}]}`
- `list`: `{"pattern":"list","title":"Logs","items":[{"primary":"Started"}]}`
- `settings`: `{"pattern":"settings","title":"Prefs","groups":[{"title":"General","settings":[{"name":"x","label":"X","type":"toggle"}]}]}`
- `profile`: `{"pattern":"profile","title":"Agent","name":"Souta"}`
- `article`: `{"pattern":"article","title":"Notes","content":"## Hello"}`
- `chat`: `{"pattern":"chat","title":"Session","messages":[{"sender":"S","content":"hi"}]}`
- `terminal_output`: `{"pattern":"terminal_output","title":"Build","lines":["$ bun run build"]}`
- `progress_tracker`: `{"pattern":"progress_tracker","title":"Pipeline","steps":[{"label":"Build","status":"complete"}]}`
- `media_gallery`: `{"pattern":"media_gallery","title":"Shots","items":[{"src":"https://example.com/1.png"}]}`
- `chart`: `{"pattern":"chart","title":"Revenue","variant":"line","data":[{"month":"Jan","revenue":4200}]}`

## Recommended Workflow

<!-- SKILL_VARIANT:unix:start -->
```bash
# compose then validate
echo '<intent_spec_json>' | \
  python3 $SKILL_DIR/compose.py | \
  python3 $SKILL_DIR/validate.py -
```
<!-- SKILL_VARIANT:unix:end -->

<!-- SKILL_VARIANT:windows:start -->
```powershell
# compose then validate
'<intent_spec_json>' |
  python "$env:SKILL_DIR\compose.py" |
  python "$env:SKILL_DIR\validate.py" -
```
<!-- SKILL_VARIANT:windows:end -->

Use this flow for every generated widget before calling `show_widget`.

If this skill doc conflicts with schema, schema wins:

- `specification/v0_1/json/root.json`
- `specification/v0_1/json/components.json`
- `specification/v0_1/json/events.json`
- `specification/v0_1/json/theme.json`
