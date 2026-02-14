#!/usr/bin/env python3
"""Semantic compose for IntentSpec -> EUIP JSON."""

import argparse
import json
import os
import subprocess
import sys


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VALIDATE_SCRIPT = os.path.join(SCRIPT_DIR, "validate.py")


class ComposeError(Exception):
    def __init__(self, error, message, stage, exit_code):
        super().__init__(message)
        self.error = error
        self.message = message
        self.stage = stage
        self.exit_code = exit_code


class PatternBuilder:
    def validate(self, spec):
        raise NotImplementedError

    def build(self, spec):
        raise NotImplementedError


PROJECTION_SIZE_PRESETS = frozenset(["auto", "sm", "md", "lg", "xl", "full"])


def normalize_projection_size(size):
    if isinstance(size, str) and size in PROJECTION_SIZE_PRESETS:
        return size
    if isinstance(size, dict):
        if "ratio" in size:
            ratio = size.get("ratio")
            if isinstance(ratio, str) and ":" in ratio:
                normalized: dict[str, object] = {"ratio": ratio}
                width = size.get("width")
                if isinstance(width, (int, float)) and not isinstance(width, bool):
                    normalized["width"] = width
                max_width = size.get("maxWidth")
                if isinstance(max_width, (int, float)) and not isinstance(
                    max_width, bool
                ):
                    normalized["maxWidth"] = max_width
                base = size.get("base")
                if base in ("sm", "md", "lg", "xl"):
                    normalized["base"] = base
                return normalized

        width = size.get("width")
        height = size.get("height")
        if isinstance(width, (int, float)) and isinstance(height, (int, float)):
            return {"width": width, "height": height}

        return size
    return "auto"


def projection(title, size="auto", theme=None, children=None):
    props = {
        "title": title,
        "size": normalize_projection_size(size),
        "position": {"anchor": "center", "offset": {"x": 0, "y": 0}},
    }
    if theme is not None:
        props["theme"] = theme
    return {"type": "projection", "props": props, "children": children or []}


def field_node(children=None):
    # Field overflow is "visible" because scrolling is handled inside the Shard
    # via a scroll wrapper. Field(overflow=scroll) + Shard(h-full, overflow-hidden)
    # creates a deadlock where neither component scrolls. See M00028.
    return {
        "type": "field",
        "props": {"safeArea": True, "contentPadding": "md", "overflow": "visible"},
        "children": children or [],
    }


def shard(title="", variant="glass", children=None, closable=True):
    # Wrap children in a scroll node so content can scroll inside the Shard body.
    # Shard's outer div has overflow-hidden (window frame), and its body div has
    # flex-1 min-h-0. The scroll node (h-full min-h-0 overflow-y-auto) inherits
    # the constrained height and enables vertical scrolling for overflow content.
    wrapped = scroll(children=children or [])
    return {
        "type": "shard",
        "props": {"title": title, "variant": variant, "closable": closable},
        "children": [wrapped],
    }


def col(children=None, **props):
    p = {"gap": "2"}
    p.update(props)
    return {"type": "col", "props": p, "children": children or []}


def row(children=None, **props):
    p = {"gap": "2"}
    p.update(props)
    return {"type": "row", "props": p, "children": children or []}


def grid(children=None, **props):
    p = {"columns": 2, "gap": "2"}
    p.update(props)
    return {"type": "grid", "props": p, "children": children or []}


def scroll(children=None, **props):
    p = {"orientation": "vertical", "scrollbarVisibility": "auto"}
    p.update(props)
    return {"type": "scroll", "props": p, "children": children or []}


def text(content, **props):
    p = {"content": str(content)}
    p.update(props)
    return {"type": "text", "props": p}


def icon(name, **props):
    p = {"name": name}
    p.update(props)
    return {"type": "icon", "props": p}


def divider():
    return {"type": "divider"}


def badge(label, **props):
    p = {"label": str(label)}
    p.update(props)
    return {"type": "badge", "props": p}


def button(label, action, **props):
    p = {"label": label, "action": action, "variant": "primary"}
    p.update(props)
    return {"type": "button", "props": p}


def input_atom(name, **props):
    p = {"name": name, "action": "input_change", "placeholder": ""}
    p.update(props)
    return {"type": "input", "props": p}


def select_atom(name, options, **props):
    p = {"name": name, "action": "select_change", "options": options}
    p.update(props)
    return {"type": "select", "props": p}


def switch_atom(name, **props):
    p = {"name": name, "action": "switch_change", "checked": False}
    p.update(props)
    return {"type": "switch", "props": p}


def checkbox_atom(name, **props):
    p = {"name": name, "action": "checkbox_change", "checked": False}
    p.update(props)
    return {"type": "checkbox", "props": p}


def radio_atom(name, options, **props):
    p = {"name": name, "action": "radiogroup_change", "options": options}
    p.update(props)
    return {"type": "radiogroup", "props": p}


def image_atom(src, **props):
    p = {"src": src}
    p.update(props)
    return {"type": "image", "props": p}


def avatar_atom(**props):
    return {"type": "avatar", "props": props}


def markdown_atom(content, **props):
    p = {"content": content}
    p.update(props)
    return {"type": "markdown", "props": p}


def terminal_atom(lines, **props):
    p = {"lines": lines}
    p.update(props)
    return {"type": "terminal", "props": p}


def progress_atom(value=0, **props):
    p = {"value": value}
    p.update(props)
    return {"type": "progress", "props": p}


def spinner_atom(**props):
    return {"type": "spinner", "props": props}


def link_atom(label, **props):
    p = {"label": label}
    p.update(props)
    return {"type": "link", "props": p}


def chart_atom(variant, data, **props):
    p = {"variant": variant, "data": data}
    p.update(props)
    return {"type": "chart", "props": p}


CHART_OPTIONAL_PROPS = (
    "xKey",
    "series",
    "labelKey",
    "valueKey",
    "stacked",
    "horizontal",
    "donut",
    "showGrid",
    "showLegend",
    "showTooltip",
    "animate",
    "xLabel",
    "yLabel",
    "height",
    "colors",
)


def slider_atom(name, **props):
    p = {
        "name": name,
        "action": "input_change",
        "min": 0,
        "max": 100,
        "step": 1,
        "value": 0,
    }
    p.update(props)
    return {"type": "slider", "props": p}


def textarea_atom(name, **props):
    p = {"name": name, "action": "input_change", "placeholder": ""}
    p.update(props)
    return {"type": "textarea", "props": p}


# -- Style prop mapping --
# EUIP uses two different style prop names depending on component type:
#   _style: Layouts (row/col/grid/box/stack/pinned/zstack/scroll) + text + divider
#   style:  All other atoms (button/badge/avatar/image/input/...)
# Components that accept neither: field, shard, spacer, icon, tooltip, toast
# See /docs/guidelines/component-standards.md Section 3.4 for rationale.
_STYLE_COMPONENTS = frozenset(
    [
        "row",
        "col",
        "grid",
        "box",
        "stack",
        "pinned",
        "zstack",
        "scroll",
        "text",
        "divider",
        "chart",
    ]
)


def style_prop_name(component_type):
    """Return the correct style prop name for a given EUIP component type."""
    if component_type in _STYLE_COMPONENTS:
        return "_style"
    return "style"


def is_non_empty_string(value):
    return isinstance(value, str) and value.strip() != ""


def to_label(name):
    return str(name).replace("_", " ").replace("-", " ").strip().title()


def ensure_list(spec, key, stage="spec_validation"):
    value = spec.get(key)
    if not isinstance(value, list):
        raise ComposeError(
            "MISSING_FIELD",
            "'{}' is required and must be an array".format(key),
            stage,
            1,
        )
    return value


def ensure_object(value, message):
    if not isinstance(value, dict):
        raise ComposeError("MISSING_FIELD", message, "spec_validation", 1)


def normalize_options(options):
    if not isinstance(options, list) or len(options) == 0:
        return [{"label": "Select", "value": ""}]
    normalized = []
    for option in options:
        if isinstance(option, dict):
            label = option.get("label", option.get("value", "Option"))
            value = option.get("value", label)
            normalized.append({"label": str(label), "value": str(value)})
        else:
            normalized.append({"label": str(option), "value": str(option)})
    return normalized


def clamp_progress(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return max(0, min(100, value))


def status_color(status):
    status_key = str(status).lower()
    if status_key in ("ok", "success", "complete"):
        return "#22c55e"
    if status_key in ("warning",):
        return "#f59e0b"
    if status_key in ("error", "critical"):
        return "#ef4444"
    if status_key in ("pending",):
        return "#6b7280"
    return "#3b82f6"


def normalize_avatar_props(value, default_size=None):
    if not isinstance(value, dict):
        return None
    props = {}
    if is_non_empty_string(value.get("src")):
        props["src"] = str(value["src"])
    if is_non_empty_string(value.get("alt")):
        props["alt"] = str(value["alt"])
    if is_non_empty_string(value.get("fallback")):
        props["fallback"] = str(value["fallback"])

    size = value.get("size")
    if size in ("sm", "md", "lg", "xl"):
        props["size"] = size
    elif default_size in ("sm", "md", "lg", "xl"):
        props["size"] = default_size

    shape = value.get("shape")
    if shape in ("circle", "square", "rounded"):
        props["shape"] = shape

    status = value.get("status")
    if status in ("online", "offline", "busy", "away"):
        props["status"] = status

    return props


def build_actions(actions, default_actions):
    src = actions if isinstance(actions, list) and len(actions) > 0 else default_actions
    result = []
    for action in src:
        if not isinstance(action, dict):
            continue
        label = action.get("label", "Action")
        action_name = action.get("action")
        if not is_non_empty_string(action_name):
            action_name = "action_{}".format(label.lower().replace(" ", "_"))
        result.append(
            button(
                label=str(label),
                action=str(action_name),
                variant=action.get("variant", "primary"),
            )
        )
    return result


def map_form_field_to_atom(field):
    field_type = str(field.get("type", "text")).lower()
    name = str(field.get("name", "field"))
    placeholder = str(field.get("placeholder", ""))

    if field_type == "hidden":
        return None
    if field_type == "readonly":
        return text(field.get("default", ""), variant="body")
    if field_type == "select":
        return select_atom(
            name=name,
            options=normalize_options(field.get("options")),
            placeholder="Select",
        )
    if field_type == "radio":
        return radio_atom(name=name, options=normalize_options(field.get("options")))
    if field_type == "toggle":
        return switch_atom(
            name=name,
            checked=bool(field.get("default", False)),
            label=field.get("label", to_label(name)),
        )
    if field_type == "checkbox":
        return checkbox_atom(
            name=name,
            checked=bool(field.get("default", False)),
            label=field.get("label", to_label(name)),
        )
    if field_type == "textarea":
        return textarea_atom(
            name=name,
            placeholder=placeholder,
            value=str(field.get("default", "")),
        )
    if field_type == "number":
        return input_atom(
            name=name,
            placeholder=placeholder,
            value=str(field.get("default", "")),
            type="number",
        )
    if field_type == "email":
        if not placeholder:
            placeholder = "name@example.com"
        return input_atom(
            name=name,
            placeholder=placeholder,
            value=str(field.get("default", "")),
            type="email",
        )
    if field_type == "password":
        if not placeholder:
            placeholder = "Enter password"
        return input_atom(
            name=name,
            placeholder=placeholder,
            value=str(field.get("default", "")),
            type="password",
        )
    return input_atom(
        name=name,
        placeholder=placeholder,
        value=str(field.get("default", "")),
        type="text",
    )


def wrap_in_projection(title, content_children, size="auto", theme=None):
    content = col(children=content_children, gap="4")
    return projection(
        title=title,
        size=size,
        theme=theme,
        children=[
            field_node(
                children=[shard(title=title, variant="glass", children=[content])]
            )
        ],
    )


def build_labeled_field(block):
    """Label + input control. Returns list of nodes."""
    field_data = {
        "name": block.get("name", "field"),
        "type": block.get("type", "text"),
        "placeholder": block.get("placeholder", ""),
        "default": block.get("default", ""),
        "options": block.get("options"),
    }
    atom = map_form_field_to_atom(field_data)
    if atom is None:
        return []
    children = [
        text(block.get("label", to_label(block.get("name", "field"))), variant="label"),
        atom,
    ]
    error = block.get("error")
    if is_non_empty_string(error):
        children.append(text(error, variant="label", _style={"color": "#FF4444"}))
    return [col(children=children, gap="2")]


def build_action_row(block):
    """Row of buttons. Returns list of nodes."""
    actions = block.get("actions", [])
    if not isinstance(actions, list) or len(actions) == 0:
        return []
    return [row(children=build_actions(actions, []), justify="end", gap="3")]


def build_key_value(block):
    """Key-value pair. Returns list of nodes."""
    key_text = str(block.get("key", ""))
    value_text = str(block.get("value", ""))
    return [
        row(
            children=[
                text(key_text, variant="label"),
                text(value_text, variant="body"),
            ],
            justify="between",
            align="center",
        )
    ]


def build_metric_card(block):
    """Single metric. Returns list of nodes."""
    label = block.get("label", "Metric")
    value = block.get("value", "")
    card_children = [text(label, variant="label"), text(str(value), variant="h2")]
    trend = block.get("trend")
    if is_non_empty_string(trend):
        card_children.append(badge(str(trend).upper(), variant="outline"))
    metric_status = block.get("status")
    if is_non_empty_string(metric_status):
        card_children.append(
            badge(
                str(metric_status).upper(),
                variant="outline",
                color=status_color(metric_status),
            )
        )
    progress_value = clamp_progress(block.get("progress"))
    if progress_value is not None:
        card_children.append(progress_atom(value=int(progress_value), max=100))
    return [col(children=card_children, gap="1")]


def build_status_badge(block):
    """Status indicator. Returns list of nodes."""
    label = str(block.get("label", ""))
    children = []
    icon_name = block.get("icon")
    if is_non_empty_string(icon_name):
        children.append(icon(icon_name))
    status = block.get("status")
    color = status_color(status) if is_non_empty_string(status) else None
    if color:
        children.append(badge(label, variant="outline", color=color))
    else:
        children.append(badge(label, variant="outline"))
    return [row(children=children, gap="2", align="center")]


def build_avatar_header(block):
    """Avatar + name + subtitle. Returns list of nodes."""
    name = str(block.get("name", ""))
    children = []
    avatar_props = normalize_avatar_props(block.get("avatar"), default_size="md")
    if avatar_props:
        children.append(avatar_atom(**avatar_props))
    elif is_non_empty_string(block.get("icon")):
        children.append(icon(block["icon"], size="md"))
    name_children = [text(name, variant="h3")]
    subtitle = block.get("subtitle")
    if is_non_empty_string(subtitle):
        name_children.append(text(subtitle, variant="body"))
    children.append(col(children=name_children, gap="1"))
    return [row(children=children, gap="2", align="center")]


def build_empty_state(block):
    """No-data placeholder. Returns list of nodes."""
    children = []
    icon_name = block.get("icon")
    if is_non_empty_string(icon_name):
        children.append(icon(icon_name, size="lg"))
    children.append(text(block.get("title", "No data"), variant="h3"))
    description = block.get("description")
    if is_non_empty_string(description):
        children.append(text(description, variant="body"))
    action = block.get("action")
    if isinstance(action, dict) and is_non_empty_string(action.get("label")):
        children.append(
            button(
                action["label"],
                action.get("action", "action"),
                variant=action.get("variant", "primary"),
            )
        )
    return [col(children=children, gap="2", align="center")]


def build_alert_box(block):
    """Inline notification. Returns list of nodes."""
    variant_icons = {
        "info": "info",
        "warning": "alert-triangle",
        "error": "x-circle",
        "success": "check-circle",
    }
    variant = str(block.get("variant", "info"))
    icon_name = variant_icons.get(variant, "info")
    right_children = []
    title = block.get("title")
    if is_non_empty_string(title):
        right_children.append(text(title, variant="label"))
    right_children.append(text(block.get("message", ""), variant="body"))
    return [
        row(
            children=[
                icon(icon_name, size="md"),
                col(children=right_children, gap="1"),
            ],
            gap="2",
            align="start",
        )
    ]


def build_search_box(block):
    """Search input with icon. Returns list of nodes."""
    name = block.get("name", "search")
    placeholder = block.get("placeholder", "Search...")
    search_action = block.get("action", "search")
    return [
        row(
            children=[
                icon("search", size="sm"),
                input_atom(name, placeholder=placeholder, action=search_action),
            ],
            gap="2",
            align="center",
        )
    ]


def build_divider_block(block):
    """Visual separator. Returns list of nodes."""
    _ = block
    return [divider()]


def build_text_block(block):
    """Text content. Returns list of nodes."""
    content = str(block.get("content", ""))
    variant = block.get("variant", "body")
    return [text(content, variant=variant)]


def build_markdown_block(block):
    """Rendered markdown. Returns list of nodes."""
    content = str(block.get("content", ""))
    return [markdown_atom(content)]


def build_form_section(block):
    """Group of form fields. Returns list of nodes."""
    fields = block.get("fields", [])
    if not isinstance(fields, list):
        fields = []
    groups = []
    for field in fields:
        if not isinstance(field, dict):
            continue
        field_atom = map_form_field_to_atom(field)
        if field_atom is None:
            continue
        field_label = field.get("label", to_label(field.get("name", "field")))
        groups.append(
            col(children=[text(field_label, variant="label"), field_atom], gap="2")
        )
    children = []
    description = block.get("description")
    if is_non_empty_string(description):
        children.append(text(description, variant="body"))
    children.extend(groups)
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="4")]


def build_data_table_section(block):
    """Tabular data. Returns list of nodes."""
    columns = block.get("columns", [])
    if not isinstance(columns, list):
        columns = []
    rows_data = block.get("rows", [])
    if not isinstance(rows_data, list):
        rows_data = []
    row_actions = block.get("row_actions", [])
    if not isinstance(row_actions, list):
        row_actions = []
    has_actions = len(row_actions) > 0
    column_count = len(columns) + (1 if has_actions else 0)
    header_cells = [
        text(col_def.get("label", to_label(col_def.get("key", ""))), variant="label")
        for col_def in columns
        if isinstance(col_def, dict)
    ]
    if has_actions:
        header_cells.append(text("Actions", variant="label"))
    children = [
        grid(children=header_cells, columns=max(column_count, 1), gap="2"),
        divider(),
    ]
    if len(rows_data) == 0:
        children.append(text(block.get("empty_message", "No data"), variant="body"))
    else:
        for row_data in rows_data:
            row_obj = row_data if isinstance(row_data, dict) else {}
            cells = [
                text(str(row_obj.get(col_def.get("key", ""), "")))
                for col_def in columns
                if isinstance(col_def, dict)
            ]
            if has_actions:
                action_buttons = build_actions(row_actions, [])
                cells.append(row(children=action_buttons, gap="2"))
            children.append(grid(children=cells, columns=max(column_count, 1), gap="2"))
    return [col(children=children, gap="2")]


def build_metrics_row(block):
    """Grid of metric cards. Returns list of nodes."""
    metrics = block.get("metrics", [])
    if not isinstance(metrics, list):
        metrics = []
    cards = []
    for metric in metrics:
        cards.extend(build_metric_card(metric if isinstance(metric, dict) else {}))
    if not cards:
        return [text("No metrics", variant="body")]
    return [grid(children=cards, columns=dashboard_columns(len(cards)), gap="3")]


def build_detail_section(block):
    """Key-value detail group. Returns list of nodes."""
    label_style = {"flexShrink": 0, "width": "30%"}
    value_style = {"flex": 1, "minWidth": 0}
    truncate_style = {
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap",
    }
    fields = block.get("fields", [])
    if not isinstance(fields, list):
        fields = []
    rows_list = []
    for item in fields:
        if not isinstance(item, dict):
            continue
        value_text = str(item.get("value", ""))
        is_badge_val = bool(item.get("badge", False))
        if is_badge_val:
            value_node = badge(value_text, variant="outline")
        else:
            value_node = text(value_text, variant="body", _style=truncate_style)
        rows_list.append(
            row(
                children=[
                    text(
                        str(item.get("label", "")), variant="label", _style=label_style
                    ),
                    value_node,
                ],
                gap="3",
                align="center",
                _style=value_style,
            )
        )
    children = []
    avatar_data = block.get("avatar")
    avatar_props = normalize_avatar_props(avatar_data, default_size="md")
    if avatar_props:
        children.append(
            row(children=[avatar_atom(**avatar_props)], gap="2", align="center")
        )
    children.append(col(children=rows_list, gap="2"))
    return [col(children=children, gap="3")]


def build_settings_group(block):
    """Settings group with controls. Returns list of nodes."""
    title_text = block.get("title", "Settings")
    settings = block.get("settings", [])
    if not isinstance(settings, list):
        settings = []
    settings_rows = []
    for setting in settings:
        setting_obj = setting if isinstance(setting, dict) else {}
        name = setting_obj.get("name", "")
        label = setting_obj.get("label", "")
        if not is_non_empty_string(name) or not is_non_empty_string(label):
            continue
        right_control = map_form_field_to_atom(setting_obj)
        if right_control is None:
            continue
        left_children = [text(label, variant="body")]
        description = setting_obj.get("description")
        if is_non_empty_string(description):
            left_children.append(text(description, variant="body"))
        settings_rows.append(
            row(
                children=[col(children=left_children, gap="1"), right_control],
                justify="between",
                align="center",
                gap="3",
            )
        )
    children = [
        text(title_text, variant="h3"),
        divider(),
        col(children=settings_rows, gap="2"),
    ]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="2")]


def build_chat_log(block):
    """Message stream. Returns list of nodes."""
    bubble_style = {"flex": 1, "minWidth": 0}
    messages = block.get("messages", [])
    if not isinstance(messages, list):
        messages = []
    message_rows = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        sender = str(message.get("sender", ""))
        msg_content = str(message.get("content", ""))
        if not sender or not msg_content:
            continue
        avatar_props = normalize_avatar_props(message.get("avatar"), default_size="sm")
        if not avatar_props:
            avatar_props = {"fallback": sender[:1].upper(), "size": "sm"}
        bubble_children = []
        header_children = [text(sender, variant="label")]
        if is_non_empty_string(message.get("time", "")):
            header_children.append(text(str(message["time"]), variant="body"))
        bubble_children.append(row(children=header_children, justify="between"))
        if str(message.get("format", "text")).lower() == "markdown":
            bubble_children.append(markdown_atom(msg_content))
        else:
            bubble_children.append(text(msg_content, variant="body"))
        avatar_node = avatar_atom(**avatar_props)
        avatar_node["props"][style_prop_name("avatar")] = {"flexShrink": 0}
        message_rows.append(
            row(
                children=[
                    avatar_node,
                    col(
                        children=bubble_children,
                        gap="1",
                        p="2",
                        border=True,
                        rounded="md",
                        _style=bubble_style,
                    ),
                ],
                align="start",
                gap="2",
            )
        )
    children = [
        scroll(
            children=message_rows,
            orientation="vertical",
            scrollbarVisibility="auto",
            border=True,
            rounded="md",
            p="2",
        )
    ]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="3")]


def build_terminal_panel(block):
    """Terminal output. Returns list of nodes."""
    lines = block.get("lines", [])
    if not isinstance(lines, list):
        lines = []
    children = []
    status = block.get("status")
    if is_non_empty_string(status):
        status_children = [
            badge(str(status).upper(), variant="outline", color=status_color(status))
        ]
        if str(status).lower() == "running":
            status_children.insert(0, spinner_atom(size="sm"))
        children.append(row(children=status_children, gap="2", align="center"))
    children.append(terminal_atom([str(line) for line in lines], autoScroll=True))
    progress_value = clamp_progress(block.get("progress"))
    if progress_value is not None:
        children.append(progress_atom(value=int(progress_value), max=100))
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="3")]


def build_step_tracker(block):
    """Multi-step progress. Returns list of nodes."""
    status_icon = {
        "complete": "check-circle",
        "in_progress": "loader",
        "pending": "circle",
        "error": "x-circle",
    }
    steps = block.get("steps", [])
    if not isinstance(steps, list):
        steps = []
    step_nodes = []
    for step in steps:
        if not isinstance(step, dict):
            continue
        status = str(step.get("status", "pending"))
        icon_name = status_icon.get(status, "circle")
        main_row = row(
            children=[
                icon(icon_name, color=status_color(status)),
                text(str(step.get("label", "")), variant="body"),
            ],
            gap="2",
            align="center",
        )
        step_children = [main_row]
        progress_value = clamp_progress(step.get("progress"))
        if progress_value is not None:
            step_children.append(progress_atom(value=int(progress_value), max=100))
        if is_non_empty_string(step.get("message", "")):
            step_children.append(text(str(step["message"]), variant="body"))
        step_nodes.append(
            col(children=step_children, gap="1", p="2", border=True, rounded="md")
        )
    children = [col(children=step_nodes, gap="2")]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="3")]


def build_media_grid(block):
    """Image grid. Returns list of nodes."""
    items = block.get("items", [])
    if not isinstance(items, list):
        items = []
    columns = block.get("columns")
    if not isinstance(columns, int) or columns < 1:
        if len(items) <= 1:
            columns = 1
        elif len(items) <= 4:
            columns = 2
        else:
            columns = 3
    cards = []
    for item in items:
        if not isinstance(item, dict):
            continue
        src = item.get("src")
        if not is_non_empty_string(src):
            continue
        card_children = [
            image_atom(str(src), alt=str(item.get("alt", "")), rounded=True)
        ]
        if is_non_empty_string(item.get("caption", "")):
            card_children.append(text(str(item["caption"]), variant="body"))
        cards.append(col(children=card_children, gap="1"))
    children = [grid(children=cards, columns=columns, gap="2")]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="3")]


def build_chart_panel(block):
    """Data visualization. Returns list of nodes."""
    valid_variants = frozenset(["line", "bar", "pie", "area"])
    variant = block.get("variant", "line")
    if variant not in valid_variants:
        variant = "line"
    data = block.get("data", [])
    if not isinstance(data, list):
        data = []
    chart_props = {}
    for key in CHART_OPTIONAL_PROPS:
        if key in block:
            chart_props[key] = block[key]
    chart = chart_atom(variant, data, **chart_props)
    children = [chart]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="2")]


def build_chart_with_header(block):
    """Chart with title header and optional badge. Returns list of nodes."""
    title = str(block.get("title", "Chart"))
    variant = block.get("variant", "line")
    valid_variants = frozenset(["line", "bar", "pie", "area"])
    if variant not in valid_variants:
        variant = "line"
    data = block.get("data", [])
    if not isinstance(data, list):
        data = []
    header_children = [text(title, variant="label", color="primary")]
    badge_text = block.get("badge")
    if is_non_empty_string(badge_text):
        header_children.append(badge(str(badge_text).upper(), variant="outline"))
    header = row(children=header_children, gap="2", align="center")
    chart_props = {}
    for key in CHART_OPTIONAL_PROPS:
        if key in block:
            chart_props[key] = block[key]
    chart = chart_atom(variant, data, **chart_props)
    return [col(children=[header, chart], gap="2")]


def build_chart_legend_card(block):
    """Legend card with color indicator for chart series. Returns list of nodes."""
    label = str(block.get("label", "Series"))
    value = str(block.get("value", ""))
    color = block.get("color", "#7CFF00")
    indicator = {
        "type": "divider",
        "props": {"_style": {"borderColor": color, "borderWidth": "2px"}},
    }
    label_row = row(
        children=[text(label, variant="label")],
        gap="2",
        align="center",
    )
    card_children = [indicator, label_row, text(value, variant="h2")]
    trend = block.get("trend")
    if is_non_empty_string(trend):
        card_children.append(badge(str(trend).upper(), variant="outline"))
    return [col(children=card_children, gap="1")]


def build_chart_stat_row(block):
    """Summary statistic row for chart context. Returns list of nodes."""
    label = str(block.get("label", ""))
    value = str(block.get("value", ""))
    return [
        row(
            children=[
                text(label, variant="label"),
                {"type": "spacer", "props": {}},
                text(value, variant="mono"),
            ],
            gap="2",
            align="center",
        )
    ]


def build_chart_dashboard(block):
    """Multi-chart dashboard with optional metrics. Returns list of nodes."""
    children = []
    metrics = block.get("metrics")
    if isinstance(metrics, list) and len(metrics) > 0:
        metrics_nodes = build_metrics_row({"metrics": metrics})
        children.extend(metrics_nodes)
    charts = block.get("charts", [])
    if not isinstance(charts, list):
        charts = []
    columns = block.get("columns", 2)
    if not isinstance(columns, int) or columns < 1:
        columns = 2
    chart_nodes = []
    for chart_spec in charts:
        if not isinstance(chart_spec, dict):
            continue
        chart_nodes.extend(build_chart_with_header(chart_spec))
    if len(chart_nodes) > 0:
        children.append(grid(children=chart_nodes, columns=columns, gap="4"))
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="3")]


def build_chart_detail(block):
    """Single chart with stats breakdown. Returns list of nodes."""
    chart_nodes = build_chart_with_header(block)
    children = list(chart_nodes)
    stats = block.get("stats")
    if isinstance(stats, list) and len(stats) > 0:
        children.append(divider())
        for stat in stats:
            if not isinstance(stat, dict):
                continue
            stat_nodes = build_chart_stat_row(stat)
            children.extend(stat_nodes)
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=children, gap="2")]


def build_list_section(block):
    """Vertical item list. Returns list of nodes."""
    truncate_style = {
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap",
    }
    no_shrink_style = {"flexShrink": 0}
    body_col_style = {"flex": 1, "minWidth": 0, "overflow": "hidden"}
    items = block.get("items", [])
    if not isinstance(items, list):
        items = []
    item_action = (
        block.get("item_action") if isinstance(block.get("item_action"), dict) else None
    )
    children = []
    if len(items) == 0:
        children.append(text(block.get("empty_message", "No items"), variant="body"))
    else:
        for index, item in enumerate(items):
            item_obj = item if isinstance(item, dict) else {}
            primary = item_obj.get("primary", "")
            if not is_non_empty_string(primary):
                continue
            row_children = []
            avatar_props = normalize_avatar_props(
                item_obj.get("avatar"), default_size="md"
            )
            if avatar_props:
                node = avatar_atom(**avatar_props)
                node["props"][style_prop_name("avatar")] = no_shrink_style
                row_children.append(node)
            elif is_non_empty_string(item_obj.get("image", "")):
                node = image_atom(
                    str(item_obj["image"]), alt=str(primary), rounded=True
                )
                node["props"][style_prop_name("image")] = no_shrink_style
                row_children.append(node)
            elif is_non_empty_string(item_obj.get("icon", "")):
                row_children.append(icon(str(item_obj["icon"]), size="md"))
            body_children = [text(primary, variant="body", _style=truncate_style)]
            if is_non_empty_string(item_obj.get("secondary", "")):
                body_children.append(
                    text(item_obj["secondary"], variant="body", _style=truncate_style)
                )
            row_children.append(
                col(children=body_children, gap="1", _style=body_col_style)
            )
            if is_non_empty_string(item_obj.get("badge", "")):
                row_children.append(badge(item_obj["badge"], variant="outline"))
            if item_action and is_non_empty_string(item_action.get("action", "")):
                row_children.append(
                    button(
                        label=item_action.get("label", "Open"),
                        action=item_action["action"],
                        variant=item_action.get("variant", "ghost"),
                    )
                )
            children.append(row(children=row_children, gap="3", align="center"))
            if index < len(items) - 1:
                children.append(divider())
    outer_children = [col(children=children, gap="2")]
    actions = block.get("actions")
    if isinstance(actions, list) and len(actions) > 0:
        outer_children.append(
            row(children=build_actions(actions, []), justify="end", gap="3")
        )
    return [col(children=outer_children, gap="3")]


BLOCK_REGISTRY = {
    "labeled_field": build_labeled_field,
    "action_row": build_action_row,
    "key_value": build_key_value,
    "metric_card": build_metric_card,
    "status_badge": build_status_badge,
    "avatar_header": build_avatar_header,
    "empty_state": build_empty_state,
    "alert_box": build_alert_box,
    "search_box": build_search_box,
    "divider": build_divider_block,
    "text_block": build_text_block,
    "markdown_block": build_markdown_block,
    "form_section": build_form_section,
    "data_table": build_data_table_section,
    "metrics_row": build_metrics_row,
    "detail_section": build_detail_section,
    "settings_group": build_settings_group,
    "chat_log": build_chat_log,
    "terminal_panel": build_terminal_panel,
    "step_tracker": build_step_tracker,
    "media_grid": build_media_grid,
    "chart_panel": build_chart_panel,
    "chart_with_header": build_chart_with_header,
    "chart_legend_card": build_chart_legend_card,
    "chart_stat_row": build_chart_stat_row,
    "chart_dashboard": build_chart_dashboard,
    "chart_detail": build_chart_detail,
    "list_section": build_list_section,
}


class FormBuilder(PatternBuilder):
    def validate(self, spec):
        fields = ensure_list(spec, "fields")
        if len(fields) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'fields' must have at least one item",
                "spec_validation",
                1,
            )
        for index, field in enumerate(fields):
            ensure_object(field, "'fields[{}]' must be an object".format(index))
            if not is_non_empty_string(field.get("name")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'fields[{}].name' is required".format(index),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        description = spec.get("description", "")
        groups = []
        for field in spec["fields"]:
            field_atom = map_form_field_to_atom(field)
            if field_atom is None:
                continue
            field_label = field.get("label", to_label(field["name"]))
            groups.append(
                col(children=[text(field_label, variant="label"), field_atom], gap="2")
            )

        actions = build_actions(
            spec.get("actions"),
            [
                {"label": "Cancel", "action": "cancel", "variant": "secondary"},
                {"label": "Submit", "action": "submit", "variant": "primary"},
            ],
        )

        content_children = []
        if is_non_empty_string(description):
            content_children.append(text(description, variant="body"))
        content_children.extend(groups)
        content_children.append(row(children=actions, justify="end", gap="3"))

        content = col(children=content_children, gap="4")
        return projection(
            title=spec["title"],
            size=spec.get("size", "auto"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class DataTableBuilder(PatternBuilder):
    def validate(self, spec):
        columns = ensure_list(spec, "columns")
        ensure_list(spec, "rows")
        if len(columns) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'columns' must have at least one item",
                "spec_validation",
                1,
            )
        for index, column in enumerate(columns):
            ensure_object(column, "'columns[{}]' must be an object".format(index))
            if not is_non_empty_string(column.get("key")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'columns[{}].key' is required".format(index),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        columns = spec["columns"]
        rows_data = spec["rows"]
        row_actions = (
            spec.get("row_actions", [])
            if isinstance(spec.get("row_actions"), list)
            else []
        )
        has_actions = len(row_actions) > 0
        column_count = len(columns) + (1 if has_actions else 0)

        header_cells = [
            text(col_def.get("label", to_label(col_def["key"])), variant="label")
            for col_def in columns
        ]
        if has_actions:
            header_cells.append(text("Actions", variant="label"))

        content_children = [
            grid(children=header_cells, columns=column_count, gap="2"),
            divider(),
        ]

        if len(rows_data) == 0:
            content_children.append(
                text(spec.get("empty_message", "No data"), variant="body")
            )
        else:
            for row_data in rows_data:
                row_obj = row_data if isinstance(row_data, dict) else {}
                cells = [
                    text(str(row_obj.get(col_def["key"], ""))) for col_def in columns
                ]
                if has_actions:
                    action_buttons = build_actions(row_actions, [])
                    cells.append(row(children=action_buttons, gap="2"))
                content_children.append(
                    grid(children=cells, columns=column_count, gap="2")
                )

        content = col(children=content_children, gap="2")
        return projection(
            title=spec["title"],
            size=spec.get("size", "auto"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ConfirmationBuilder(PatternBuilder):
    def validate(self, spec):
        if not is_non_empty_string(spec.get("warning")):
            raise ComposeError(
                "MISSING_FIELD",
                "'warning' is required for confirmation",
                "spec_validation",
                1,
            )

    def build(self, spec):
        content_children = [
            row(
                children=[
                    icon("alert-triangle", size=20),
                    text(spec["title"], variant="h3"),
                ],
                gap="2",
                align="center",
            ),
            text(spec["warning"], variant="body"),
        ]

        confirm_text = spec.get("confirm_text")
        if is_non_empty_string(confirm_text):
            confirm_label = spec.get("confirm_label", "Type to confirm")
            content_children.append(
                col(
                    children=[
                        text(confirm_label, variant="label"),
                        input_atom(
                            "confirmation_input",
                            placeholder=str(confirm_text),
                            type="text",
                        ),
                    ],
                    gap="2",
                )
            )

        actions = build_actions(
            spec.get("actions"),
            [
                {"label": "Cancel", "action": "cancel", "variant": "secondary"},
                {"label": "Confirm", "action": "confirm", "variant": "danger"},
            ],
        )
        content_children.append(row(children=actions, justify="end", gap="3"))

        content = col(children=content_children, gap="4")
        return projection(
            title=spec["title"],
            size=spec.get("size", "sm"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


def dashboard_columns(metric_count):
    if metric_count <= 2:
        return 2
    if metric_count == 3:
        return 3
    if metric_count == 4:
        return 2
    if metric_count <= 6:
        return 3
    return 4


class StatusDashboardBuilder(PatternBuilder):
    def validate(self, spec):
        ensure_list(spec, "metrics")

    def build(self, spec):
        metrics = spec["metrics"]
        sections = (
            spec.get("sections", []) if isinstance(spec.get("sections"), list) else []
        )

        metric_cards = []
        for metric in metrics:
            metric_obj = metric if isinstance(metric, dict) else {}
            label = metric_obj.get("label", "Metric")
            value = metric_obj.get("value", "")
            card_children = [text(label, variant="label"), text(value, variant="h2")]
            trend = metric_obj.get("trend")
            if is_non_empty_string(trend):
                card_children.append(badge(str(trend).upper(), variant="outline"))
            metric_status = metric_obj.get("status")
            if is_non_empty_string(metric_status):
                card_children.append(
                    badge(
                        str(metric_status).upper(),
                        variant="outline",
                        color=status_color(metric_status),
                    )
                )
            progress_value = clamp_progress(metric_obj.get("progress"))
            if progress_value is not None:
                card_children.append(progress_atom(value=int(progress_value), max=100))
            metric_cards.append(col(children=card_children, gap="1"))

        content_children = []
        if metric_cards:
            content_children.append(
                grid(
                    children=metric_cards,
                    columns=dashboard_columns(len(metric_cards)),
                    gap="3",
                )
            )
        else:
            content_children.append(text("No metrics", variant="body"))

        for section in sections:
            if not isinstance(section, dict):
                continue
            section_title = section.get("title", "Section")
            items = (
                section.get("items", [])
                if isinstance(section.get("items"), list)
                else []
            )
            section_children = [text(section_title, variant="h3"), divider()]
            section_children.extend([text(str(item), variant="body") for item in items])
            content_children.append(col(children=section_children, gap="1"))

        content = col(children=content_children, gap="4")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class DetailViewBuilder(PatternBuilder):
    def validate(self, spec):
        fields = ensure_list(spec, "fields")
        if len(fields) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'fields' must have at least one item",
                "spec_validation",
                1,
            )
        for index, field in enumerate(fields):
            ensure_object(field, "'fields[{}]' must be an object".format(index))
            if not is_non_empty_string(field.get("label")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'fields[{}].label' is required".format(index),
                    "spec_validation",
                    1,
                )
            if "value" not in field:
                raise ComposeError(
                    "MISSING_FIELD",
                    "'fields[{}].value' is required".format(index),
                    "spec_validation",
                    1,
                )

    LABEL_STYLE = {"flexShrink": 0, "width": "30%"}
    VALUE_STYLE = {"flex": 1, "minWidth": 0}
    TRUNCATE_STYLE = {
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap",
    }

    def build(self, spec):
        rows = []
        for item in spec["fields"]:
            value_text = str(item["value"])
            is_badge = bool(item.get("badge", False))
            if is_badge:
                value_node = badge(value_text, variant="outline")
            else:
                value_node = text(
                    value_text, variant="body", _style=self.TRUNCATE_STYLE
                )
            rows.append(
                row(
                    children=[
                        text(
                            item["label"],
                            variant="label",
                            _style=self.LABEL_STYLE,
                        ),
                        value_node,
                    ],
                    gap="3",
                    align="center",
                    _style=self.VALUE_STYLE,
                )
            )

        content_children = []
        entity_name = str(spec.get("entity", spec.get("title", "")))
        header_avatar = normalize_avatar_props(spec.get("avatar"), default_size="md")
        header_image = spec.get("image")

        if header_avatar:
            header_children = [avatar_atom(**header_avatar)]
            if is_non_empty_string(entity_name):
                header_children.append(text(entity_name, variant="h3"))
            content_children.append(
                row(children=header_children, gap="2", align="center")
            )
        elif is_non_empty_string(header_image):
            content_children.append(
                image_atom(str(header_image), alt=entity_name, rounded=True)
            )
            if is_non_empty_string(entity_name):
                content_children.append(text(entity_name, variant="h3"))
        elif is_non_empty_string(entity_name):
            content_children.append(text(entity_name, variant="body"))
        content_children.append(col(children=rows, gap="2"))

        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="4")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ListBuilder(PatternBuilder):
    TRUNCATE_STYLE = {
        "overflow": "hidden",
        "textOverflow": "ellipsis",
        "whiteSpace": "nowrap",
    }
    NO_SHRINK_STYLE = {"flexShrink": 0}
    BODY_COL_STYLE = {"flex": 1, "minWidth": 0, "overflow": "hidden"}

    def validate(self, spec):
        ensure_list(spec, "items")

    def build(self, spec):
        items = spec["items"]
        item_action = (
            spec.get("item_action")
            if isinstance(spec.get("item_action"), dict)
            else None
        )
        content_children = []

        if len(items) == 0:
            content_children.append(
                text(spec.get("empty_message", "No items"), variant="body")
            )
        else:
            for idx, item in enumerate(items):
                item_obj = item if isinstance(item, dict) else {}
                if not is_non_empty_string(item_obj.get("primary", "")):
                    raise ComposeError(
                        "BUILD_ERROR", "List item requires 'primary'", "build", 3
                    )
                row_children = []
                avatar_props = normalize_avatar_props(
                    item_obj.get("avatar"), default_size="md"
                )
                if avatar_props:
                    node = avatar_atom(**avatar_props)
                    node["props"][style_prop_name("avatar")] = self.NO_SHRINK_STYLE
                    row_children.append(node)
                elif is_non_empty_string(item_obj.get("image", "")):
                    node = image_atom(
                        str(item_obj["image"]),
                        alt=str(item_obj["primary"]),
                        rounded=True,
                    )
                    node["props"][style_prop_name("image")] = self.NO_SHRINK_STYLE
                    row_children.append(node)
                elif is_non_empty_string(item_obj.get("icon", "")):
                    row_children.append(icon(str(item_obj["icon"]), size="md"))
                body_children = [
                    text(
                        item_obj["primary"],
                        variant="body",
                        _style=self.TRUNCATE_STYLE,
                    )
                ]
                if is_non_empty_string(item_obj.get("secondary", "")):
                    body_children.append(
                        text(
                            item_obj["secondary"],
                            variant="body",
                            _style=self.TRUNCATE_STYLE,
                        )
                    )
                row_children.append(
                    col(
                        children=body_children,
                        gap="1",
                        _style=self.BODY_COL_STYLE,
                    )
                )
                if is_non_empty_string(item_obj.get("badge", "")):
                    row_children.append(badge(item_obj["badge"], variant="outline"))
                if item_action and is_non_empty_string(item_action.get("action", "")):
                    row_children.append(
                        button(
                            label=item_action.get("label", "Open"),
                            action=item_action["action"],
                            variant=item_action.get("variant", "ghost"),
                        )
                    )
                content_children.append(
                    row(children=row_children, gap="3", align="center")
                )
                if idx < len(items) - 1:
                    content_children.append(divider())

        content = col(children=content_children, gap="2")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class SettingsBuilder(PatternBuilder):
    def validate(self, spec):
        groups = ensure_list(spec, "groups")
        if len(groups) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'groups' must have at least one item",
                "spec_validation",
                1,
            )
        for index, group in enumerate(groups):
            ensure_object(group, "'groups[{}]' must be an object".format(index))
            if not is_non_empty_string(group.get("title")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'groups[{}].title' is required".format(index),
                    "spec_validation",
                    1,
                )
            ensure_list(group, "settings")

    def build(self, spec):
        group_nodes = []
        for group in spec["groups"]:
            settings_rows = []
            for setting in group["settings"]:
                setting_obj = setting if isinstance(setting, dict) else {}
                if not is_non_empty_string(setting_obj.get("name", "")):
                    raise ComposeError(
                        "BUILD_ERROR", "Setting requires 'name'", "build", 3
                    )
                if not is_non_empty_string(setting_obj.get("label", "")):
                    raise ComposeError(
                        "BUILD_ERROR", "Setting requires 'label'", "build", 3
                    )

                right_control = map_form_field_to_atom(setting_obj)
                if right_control is None:
                    continue
                left_children = [text(setting_obj["label"], variant="body")]
                if is_non_empty_string(setting_obj.get("description", "")):
                    left_children.append(
                        text(setting_obj["description"], variant="body")
                    )
                settings_rows.append(
                    row(
                        children=[col(children=left_children, gap="1"), right_control],
                        justify="between",
                        align="center",
                        gap="3",
                    )
                )

            group_nodes.append(
                col(
                    children=[
                        text(group["title"], variant="h3"),
                        divider(),
                        col(children=settings_rows, gap="2"),
                    ],
                    gap="2",
                )
            )

        actions = build_actions(
            spec.get("actions"),
            [{"label": "Save", "action": "save", "variant": "primary"}],
        )
        content = col(
            children=group_nodes + [row(children=actions, justify="end", gap="3")],
            gap="4",
        )
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class MessageBuilder(PatternBuilder):
    VARIANT_TO_COLOR = {
        "info": "#3b82f6",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444",
    }

    def validate(self, spec):
        if not is_non_empty_string(spec.get("message")):
            raise ComposeError(
                "MISSING_FIELD",
                "'message' is required for message pattern",
                "spec_validation",
                1,
            )

    def build(self, spec):
        variant = str(spec.get("variant", "info"))
        message_format = str(spec.get("format", "text")).lower()
        content_children = []
        if is_non_empty_string(spec.get("icon", "")):
            content_children.append(icon(spec["icon"], size="lg"))
        content_children.append(text(spec["title"], variant="h2"))
        if message_format == "markdown":
            content_children.append(markdown_atom(spec["message"]))
        else:
            content_children.append(text(spec["message"], variant="body"))
        content_children.append(
            badge(
                variant.upper(),
                variant="outline",
                color=self.VARIANT_TO_COLOR.get(variant, "#3b82f6"),
            )
        )
        actions = build_actions(
            spec.get("actions"),
            [{"label": "OK", "action": "ok", "variant": "primary"}],
        )
        content_children.append(row(children=actions, justify="center", gap="3"))

        content = col(children=content_children, gap="3", align="center")
        return projection(
            title=spec["title"],
            size=spec.get("size", "sm"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ProfileBuilder(PatternBuilder):
    def validate(self, spec):
        if not is_non_empty_string(spec.get("name")):
            raise ComposeError(
                "MISSING_FIELD",
                "'name' is required for profile pattern",
                "spec_validation",
                1,
            )
        fields = spec.get("fields", [])
        if fields is not None and not isinstance(fields, list):
            raise ComposeError(
                "MISSING_FIELD",
                "'fields' must be an array when provided",
                "spec_validation",
                1,
            )
        for index, field in enumerate(fields or []):
            ensure_object(field, "'fields[{}]' must be an object".format(index))
            if not is_non_empty_string(field.get("label")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'fields[{}].label' is required".format(index),
                    "spec_validation",
                    1,
                )
            if "value" not in field:
                raise ComposeError(
                    "MISSING_FIELD",
                    "'fields[{}].value' is required".format(index),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        content_children = []
        avatar_props = normalize_avatar_props(spec.get("avatar"), default_size="xl")
        if avatar_props:
            if "shape" not in avatar_props:
                avatar_props["shape"] = "circle"
            content_children.append(
                row(children=[avatar_atom(**avatar_props)], justify="center")
            )

        content_children.append(text(spec["name"], variant="h2", align="center"))
        if is_non_empty_string(spec.get("subtitle", "")):
            content_children.append(
                text(spec["subtitle"], variant="body", align="center")
            )

        fields = spec.get("fields", []) if isinstance(spec.get("fields"), list) else []
        if fields:
            field_rows = []
            for field in fields:
                label_node = text(str(field.get("label", "")), variant="label")
                field_value = field.get("value", "")
                if bool(field.get("badge", False)):
                    value_node = badge(str(field_value), variant="outline")
                else:
                    value_node = text(str(field_value), variant="body")
                field_rows.append(
                    row(
                        children=[label_node, value_node],
                        justify="between",
                        align="center",
                    )
                )
            content_children.append(col(children=field_rows, gap="2"))

        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="center", gap="3")
            )

        content = col(children=content_children, gap="3")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ArticleBuilder(PatternBuilder):
    def validate(self, spec):
        if not is_non_empty_string(spec.get("content")):
            raise ComposeError(
                "MISSING_FIELD",
                "'content' is required for article pattern",
                "spec_validation",
                1,
            )

    def build(self, spec):
        content_children = []
        hero_image = spec.get("hero_image")
        if isinstance(hero_image, dict) and is_non_empty_string(
            hero_image.get("src", "")
        ):
            content_children.append(
                image_atom(
                    str(hero_image["src"]),
                    alt=str(hero_image.get("alt", spec["title"])),
                    rounded=True,
                )
            )

        content_children.append(text(spec["title"], variant="h1"))

        author = spec.get("author") if isinstance(spec.get("author"), dict) else None
        published = spec.get("published")
        if author or is_non_empty_string(published):
            author_children = []
            if author:
                author_avatar = normalize_avatar_props(
                    author.get("avatar"), default_size="sm"
                )
                if author_avatar:
                    author_children.append(avatar_atom(**author_avatar))
                if is_non_empty_string(author.get("name", "")):
                    author_children.append(text(str(author["name"]), variant="label"))
            if is_non_empty_string(published):
                author_children.append(text(str(published), variant="body"))
            if author_children:
                content_children.append(
                    row(children=author_children, gap="2", align="center")
                )

        content_children.append(markdown_atom(spec["content"]))

        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="3")
        return projection(
            title=spec["title"],
            size=spec.get("size", "lg"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ChatBuilder(PatternBuilder):
    def validate(self, spec):
        messages = ensure_list(spec, "messages")
        if len(messages) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'messages' must have at least one item",
                "spec_validation",
                1,
            )
        for index, message in enumerate(messages):
            ensure_object(message, "'messages[{}]' must be an object".format(index))
            if not is_non_empty_string(message.get("sender")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'messages[{}].sender' is required".format(index),
                    "spec_validation",
                    1,
                )
            if not is_non_empty_string(message.get("content")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'messages[{}].content' is required".format(index),
                    "spec_validation",
                    1,
                )

    BUBBLE_STYLE = {"flex": 1, "minWidth": 0}

    def build(self, spec):
        message_rows = []
        for message in spec["messages"]:
            sender = str(message["sender"])
            avatar_props = normalize_avatar_props(
                message.get("avatar"), default_size="sm"
            )
            if not avatar_props:
                avatar_props = {"fallback": sender[:1].upper(), "size": "sm"}

            bubble_children = []
            header_children = [text(sender, variant="label")]
            if is_non_empty_string(message.get("time", "")):
                header_children.append(text(str(message["time"]), variant="body"))
            bubble_children.append(row(children=header_children, justify="between"))

            if str(message.get("format", "text")).lower() == "markdown":
                bubble_children.append(markdown_atom(message["content"]))
            else:
                bubble_children.append(text(message["content"], variant="body"))

            avatar_node = avatar_atom(**avatar_props)
            avatar_node["props"][style_prop_name("avatar")] = {"flexShrink": 0}
            message_rows.append(
                row(
                    children=[
                        avatar_node,
                        col(
                            children=bubble_children,
                            gap="1",
                            p="2",
                            border=True,
                            rounded="md",
                            _style=self.BUBBLE_STYLE,
                        ),
                    ],
                    align="start",
                    gap="2",
                )
            )

        content_children = [
            scroll(
                children=message_rows,
                orientation="vertical",
                scrollbarVisibility="auto",
                border=True,
                rounded="md",
                p="2",
            )
        ]

        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="3")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class TerminalOutputBuilder(PatternBuilder):
    def validate(self, spec):
        lines = ensure_list(spec, "lines")
        if len(lines) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'lines' must have at least one item",
                "spec_validation",
                1,
            )

    def build(self, spec):
        content_children = []
        status = spec.get("status")
        if is_non_empty_string(status):
            status_children = [
                badge(
                    str(status).upper(), variant="outline", color=status_color(status)
                )
            ]
            if str(status).lower() == "running":
                status_children.insert(0, spinner_atom(size="sm"))
            content_children.append(
                row(children=status_children, gap="2", align="center")
            )

        lines = [str(line) for line in spec.get("lines", [])]
        content_children.append(terminal_atom(lines, autoScroll=True))

        progress_value = clamp_progress(spec.get("progress"))
        if progress_value is not None:
            content_children.append(progress_atom(value=int(progress_value), max=100))

        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="3")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ProgressTrackerBuilder(PatternBuilder):
    STATUS_ICON = {
        "complete": "check-circle",
        "in_progress": "loader",
        "pending": "circle",
        "error": "x-circle",
    }

    def validate(self, spec):
        steps = ensure_list(spec, "steps")
        if len(steps) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'steps' must have at least one item",
                "spec_validation",
                1,
            )
        for index, step in enumerate(steps):
            ensure_object(step, "'steps[{}]' must be an object".format(index))
            if not is_non_empty_string(step.get("label")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'steps[{}].label' is required".format(index),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        step_nodes = []
        for step in spec["steps"]:
            status = str(step.get("status", "pending"))
            icon_name = self.STATUS_ICON.get(status, "circle")

            main_row = row(
                children=[
                    icon(icon_name, color=status_color(status)),
                    text(str(step["label"]), variant="body"),
                ],
                gap="2",
                align="center",
            )

            step_children = [main_row]
            progress_value = clamp_progress(step.get("progress"))
            if progress_value is not None:
                step_children.append(progress_atom(value=int(progress_value), max=100))
            if is_non_empty_string(step.get("message", "")):
                step_children.append(text(str(step["message"]), variant="body"))

            step_nodes.append(
                col(children=step_children, gap="1", p="2", border=True, rounded="md")
            )

        content_children = [col(children=step_nodes, gap="2")]
        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="3")
        return projection(
            title=spec["title"],
            size=spec.get("size", "md"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class MediaGalleryBuilder(PatternBuilder):
    def validate(self, spec):
        items = ensure_list(spec, "items")
        if len(items) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'items' must have at least one item",
                "spec_validation",
                1,
            )
        for index, item in enumerate(items):
            ensure_object(item, "'items[{}]' must be an object".format(index))
            if not is_non_empty_string(item.get("src")):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'items[{}].src' is required".format(index),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        items = spec["items"]
        columns = spec.get("columns")
        if not isinstance(columns, int) or columns < 1:
            if len(items) <= 1:
                columns = 1
            elif len(items) <= 4:
                columns = 2
            else:
                columns = 3

        cards = []
        for item in items:
            card_children = [
                image_atom(
                    str(item["src"]),
                    alt=str(item.get("alt", "")),
                    rounded=True,
                )
            ]
            if is_non_empty_string(item.get("caption", "")):
                card_children.append(text(str(item["caption"]), variant="body"))
            cards.append(col(children=card_children, gap="1"))

        content_children = [grid(children=cards, columns=columns, gap="2")]
        actions_src = (
            spec.get("actions", []) if isinstance(spec.get("actions"), list) else []
        )
        if actions_src:
            content_children.append(
                row(children=build_actions(actions_src, []), justify="end", gap="3")
            )

        content = col(children=content_children, gap="3")
        default_size = {
            "ratio": "16:9",
            "width": 1024,
            "maxWidth": 1200,
            "base": "lg",
        }
        return projection(
            title=spec["title"],
            size=spec.get("size", default_size),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ChartBuilder(PatternBuilder):
    VALID_VARIANTS = frozenset(["line", "bar", "pie", "area"])

    def validate(self, spec):
        variant = spec.get("variant")
        if not isinstance(variant, str) or variant not in self.VALID_VARIANTS:
            raise ComposeError(
                "MISSING_FIELD",
                "'variant' is required and must be one of: {}".format(
                    ", ".join(sorted(self.VALID_VARIANTS))
                ),
                "spec_validation",
                1,
            )
        data = ensure_list(spec, "data")
        if len(data) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'data' must have at least one item",
                "spec_validation",
                1,
            )
        for index, row_item in enumerate(data):
            ensure_object(row_item, "'data[{}]' must be an object".format(index))

    def build(self, spec):
        variant = spec["variant"]
        data = spec["data"]
        chart_props = {}
        for key in CHART_OPTIONAL_PROPS:
            if key in spec:
                chart_props[key] = spec[key]

        chart = chart_atom(variant, data, **chart_props)
        content = col(children=[chart], gap="2")
        return projection(
            title=spec["title"],
            size=spec.get("size", "auto"),
            theme=spec.get("theme"),
            children=[
                field_node(
                    children=[
                        shard(title=spec["title"], variant="glass", children=[content])
                    ]
                )
            ],
        )


class ComposeBuilder(PatternBuilder):
    def validate(self, spec):
        body = spec.get("body")
        if not isinstance(body, list) or len(body) == 0:
            raise ComposeError(
                "MISSING_FIELD",
                "'body' must be a non-empty array for compose pattern",
                "spec_validation",
                1,
            )
        for index, block in enumerate(body):
            ensure_object(block, "'body[{}]' must be an object".format(index))
            use = block.get("use")
            if not is_non_empty_string(use):
                raise ComposeError(
                    "MISSING_FIELD",
                    "'body[{}].use' is required".format(index),
                    "spec_validation",
                    1,
                )
            if use not in BLOCK_REGISTRY:
                available = ", ".join(sorted(BLOCK_REGISTRY.keys()))
                raise ComposeError(
                    "BLOCK_NOT_FOUND",
                    "Block '{}' not found at body[{}]. Available: {}".format(
                        use, index, available
                    ),
                    "spec_validation",
                    1,
                )

    def build(self, spec):
        content_children = []
        for block in spec["body"]:
            builder_fn = BLOCK_REGISTRY[block["use"]]
            nodes = builder_fn(block)
            content_children.extend(nodes)
        return wrap_in_projection(
            title=spec["title"],
            content_children=content_children,
            size=spec.get("size", "auto"),
            theme=spec.get("theme"),
        )


PATTERN_REGISTRY = {
    "form": FormBuilder(),
    "data_table": DataTableBuilder(),
    "confirmation": ConfirmationBuilder(),
    "status_dashboard": StatusDashboardBuilder(),
    "detail_view": DetailViewBuilder(),
    "list": ListBuilder(),
    "settings": SettingsBuilder(),
    "message": MessageBuilder(),
    "profile": ProfileBuilder(),
    "article": ArticleBuilder(),
    "chat": ChatBuilder(),
    "terminal_output": TerminalOutputBuilder(),
    "progress_tracker": ProgressTrackerBuilder(),
    "media_gallery": MediaGalleryBuilder(),
    "chart": ChartBuilder(),
    "compose": ComposeBuilder(),
}


def ensure_euip_structure(data):
    if data.get("type") != "projection":
        data = projection("Generated Widget", size="auto", children=[data])
    children = data.get("children", [])
    if not isinstance(children, list):
        children = []
    if (
        not children
        or not isinstance(children[0], dict)
        or children[0].get("type") != "field"
    ):
        data["children"] = [field_node(children=children)]
    return data


def validate_common_fields(spec):
    if not isinstance(spec, dict):
        raise ComposeError(
            "INVALID_SPEC", "IntentSpec root must be an object", "spec_validation", 1
        )
    if not is_non_empty_string(spec.get("pattern")):
        raise ComposeError(
            "MISSING_FIELD", "'pattern' is required", "spec_validation", 1
        )
    if not is_non_empty_string(spec.get("title")):
        raise ComposeError("MISSING_FIELD", "'title' is required", "spec_validation", 1)


def validate_euip(ui):
    process = subprocess.run(
        [sys.executable, VALIDATE_SCRIPT, "-"],
        input=json.dumps(ui),
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        detail = (
            process.stdout.strip() or process.stderr.strip() or "EUIP validation failed"
        )
        raise ComposeError("EUIP_VALIDATION_ERROR", detail, "euip_validation", 4)


def compose(spec):
    validate_common_fields(spec)
    pattern_name = str(spec["pattern"])
    builder = PATTERN_REGISTRY.get(pattern_name)
    if builder is None:
        available = ", ".join(sorted(PATTERN_REGISTRY.keys()))
        raise ComposeError(
            "PATTERN_NOT_FOUND",
            "Pattern '{}' not found. Available: {}".format(pattern_name, available),
            "pattern_selection",
            2,
        )

    builder.validate(spec)
    try:
        ui = builder.build(spec)
    except ComposeError:
        raise
    except Exception as exc:
        raise ComposeError("BUILD_ERROR", str(exc), "build", 3) from exc

    ui = ensure_euip_structure(ui)
    validate_euip(ui)
    return ui


def emit_error(error):
    payload = {"error": error.error, "message": error.message, "stage": error.stage}
    sys.stderr.write(json.dumps(payload) + "\n")


def read_input(path):
    if path:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    return sys.stdin.read()


def write_output(path, content):
    if path:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content)
        return
    sys.stdout.write(content)
    if not content.endswith("\n"):
        sys.stdout.write("\n")


def main():
    parser = argparse.ArgumentParser(
        description="Compose EUIP from semantic IntentSpec"
    )
    parser.add_argument(
        "--input", help="Input IntentSpec JSON file (defaults to stdin)"
    )
    parser.add_argument("--output", help="Output EUIP JSON file (defaults to stdout)")
    parser.add_argument(
        "--validate-only", action="store_true", help="Validate without emitting EUIP"
    )
    args = parser.parse_args()

    try:
        raw_content = read_input(args.input)
        intent_spec = json.loads(raw_content)
    except FileNotFoundError as exc:
        emit_error(ComposeError("INVALID_INPUT", str(exc), "input_parse", 1))
        sys.exit(1)
    except json.JSONDecodeError as exc:
        emit_error(ComposeError("INVALID_JSON", str(exc), "input_parse", 1))
        sys.exit(1)

    try:
        ui = compose(intent_spec)
        if not args.validate_only:
            write_output(args.output, json.dumps(ui, indent=2, ensure_ascii=False))
    except ComposeError as exc:
        emit_error(exc)
        sys.exit(exc.exit_code)


if __name__ == "__main__":
    main()
