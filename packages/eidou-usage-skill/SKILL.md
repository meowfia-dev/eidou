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
- `size` (optional, default `auto`; presets: `sm`, `md`, `lg`, `xl`, `full`, `auto`; ratio object: `{"ratio":"16:9","width":960,"maxWidth":1200,"base":"lg"}`)
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

Default sizing note: `media_gallery` defaults to a ratio size (`16:9`, width `1024`, maxWidth `1200`) to keep image-heavy content stable without oversized auto windows.

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
