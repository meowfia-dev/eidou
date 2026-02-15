import json
import os
import subprocess
import sys
import unittest


PACKAGE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMPOSE_PATH = os.path.join(PACKAGE_ROOT, "scripts", "compose.py")
VALIDATE_PATH = os.path.join(PACKAGE_ROOT, "scripts", "validate.py")


class TestCompose(unittest.TestCase):
    def run_compose(self, payload):
        process = subprocess.Popen(
            [sys.executable, COMPOSE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=payload)
        return process.returncode, stdout, stderr

    def validate_output(self, ui_json):
        process = subprocess.Popen(
            [sys.executable, VALIDATE_PATH, "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=ui_json)
        return process.returncode, stdout, stderr

    def find_nodes(self, node, target_type):
        found = []
        if not isinstance(node, dict):
            return found
        if node.get("type") == target_type:
            found.append(node)
        for child in node.get("children", []):
            found.extend(self.find_nodes(child, target_type))
        return found

    def test_patterns_compose_and_validate(self):
        specs = {
            "form": {
                "pattern": "form",
                "title": "Create Contact",
                "fields": [{"name": "name", "label": "Name", "type": "unknown_type"}],
            },
            "data_table": {
                "pattern": "data_table",
                "title": "Contacts",
                "columns": [{"key": "name", "label": "Name"}],
                "rows": [{"name": "Alice"}],
            },
            "confirmation": {
                "pattern": "confirmation",
                "title": "Delete",
                "warning": "This cannot be undone.",
            },
            "status_dashboard": {
                "pattern": "status_dashboard",
                "title": "System Health",
                "metrics": [
                    {
                        "label": "CPU",
                        "value": "42%",
                        "progress": 42,
                        "status": "ok",
                    }
                ],
            },
            "detail_view": {
                "pattern": "detail_view",
                "title": "Contact Details",
                "entity": "Alice",
                "avatar": {"fallback": "A", "status": "online"},
                "fields": [{"label": "Email", "value": "alice@example.com"}],
            },
            "list": {
                "pattern": "list",
                "title": "Recent Logs",
                "items": [
                    {
                        "primary": "Build completed",
                        "avatar": {"fallback": "CI", "status": "online"},
                    }
                ],
            },
            "settings": {
                "pattern": "settings",
                "title": "Preferences",
                "groups": [
                    {
                        "title": "Appearance",
                        "settings": [
                            {
                                "name": "dark_mode",
                                "label": "Dark Mode",
                                "type": "toggle",
                                "default": True,
                            }
                        ],
                    }
                ],
            },
            "message": {
                "pattern": "message",
                "title": "Hi",
                "message": "Yo",
                "format": "markdown",
            },
            "profile": {
                "pattern": "profile",
                "title": "Agent Profile",
                "name": "Souta",
                "avatar": {"fallback": "S", "status": "online"},
                "fields": [{"label": "Status", "value": "Active", "badge": True}],
            },
            "article": {
                "pattern": "article",
                "title": "Release Notes",
                "content": "## What's New\n\n- Feature A\n- Fix B",
                "author": {"name": "Souta", "avatar": {"fallback": "S"}},
                "published": "2026-02-08",
            },
            "chat": {
                "pattern": "chat",
                "title": "Session Log",
                "messages": [{"sender": "S", "content": "hi"}],
            },
            "terminal_output": {
                "pattern": "terminal_output",
                "title": "Build Log",
                "lines": ["$ cargo build", "Finished release"],
                "status": "success",
                "progress": 100,
            },
            "progress_tracker": {
                "pattern": "progress_tracker",
                "title": "Deployment Pipeline",
                "steps": [
                    {"label": "Build", "status": "complete"},
                    {"label": "Test", "status": "in_progress", "progress": 75},
                ],
            },
            "media_gallery": {
                "pattern": "media_gallery",
                "title": "Screenshots",
                "items": [
                    {
                        "src": "https://example.com/1.png",
                        "alt": "Screenshot 1",
                        "caption": "Homepage",
                    }
                ],
            },
        }

        for name, spec in specs.items():
            with self.subTest(pattern=name):
                code, out, err = self.run_compose(json.dumps(spec))
                self.assertEqual(code, 0, f"compose failed for {name}: {err}")
                v_code, v_out, _ = self.validate_output(out)
                self.assertEqual(v_code, 0, f"validate failed for {name}: {v_out}")
                self.assertIn("Validation Result: PASS", v_out)

    def test_enriched_patterns_emit_new_atoms(self):
        spec = {
            "pattern": "chat",
            "title": "Session Log",
            "messages": [
                {
                    "sender": "Souta",
                    "avatar": {"fallback": "S", "status": "online"},
                    "content": "## Build complete",
                    "format": "markdown",
                    "time": "10:30",
                }
            ],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)

        def has_type(node, target):
            if not isinstance(node, dict):
                return False
            if node.get("type") == target:
                return True
            children = node.get("children")
            if not isinstance(children, list):
                return False
            for child in children:
                if has_type(child, target):
                    return True
            return False

        self.assertTrue(has_type(data, "avatar"))
        self.assertTrue(has_type(data, "markdown"))
        self.assertTrue(has_type(data, "scroll"))

    def test_profile_emits_avatar_when_missing_avatar_spec(self):
        spec = {
            "pattern": "profile",
            "title": "Agent Profile",
            "name": "Souta Rei",
            "fields": [{"label": "Status", "value": "Active"}],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        avatars = self.find_nodes(data, "avatar")
        self.assertGreaterEqual(len(avatars), 1)
        avatar_props = avatars[0]["props"]
        self.assertNotIn("src", avatar_props)
        self.assertEqual(avatar_props.get("fallback"), "SR")
        self.assertEqual(avatar_props.get("alt"), "Souta Rei avatar")

    def test_profile_avatar_without_src_uses_name_fallback(self):
        spec = {
            "pattern": "profile",
            "title": "Agent Profile",
            "name": "Souta",
            "avatar": {"status": "online"},
            "fields": [{"label": "Status", "value": "Active"}],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        avatars = self.find_nodes(data, "avatar")
        self.assertGreaterEqual(len(avatars), 1)
        avatar_props = avatars[0]["props"]
        self.assertNotIn("src", avatar_props)
        self.assertEqual(avatar_props.get("fallback"), "SO")
        self.assertEqual(avatar_props.get("status"), "online")
        self.assertEqual(avatar_props.get("alt"), "Souta avatar")

    def test_profile_avatar_string_url_sets_src_and_derives_fallback(self):
        spec = {
            "pattern": "profile",
            "title": "Agent Profile",
            "name": "Souta Rei",
            "avatar": "https://example.com/avatar.png",
            "fields": [{"label": "Status", "value": "Active"}],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        avatars = self.find_nodes(data, "avatar")
        self.assertGreaterEqual(len(avatars), 1)
        avatar_props = avatars[0]["props"]
        self.assertEqual(avatar_props.get("src"), "https://example.com/avatar.png")
        self.assertEqual(avatar_props.get("fallback"), "SR")
        self.assertEqual(avatar_props.get("alt"), "Souta Rei avatar")

    def test_avatar_header_avatar_string_url_sets_src(self):
        spec = {
            "pattern": "compose",
            "title": "Avatar Header",
            "body": [
                {
                    "use": "avatar_header",
                    "name": "Souta",
                    "avatar": "https://example.com/header-avatar.png",
                }
            ],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        avatars = self.find_nodes(data, "avatar")
        self.assertGreaterEqual(len(avatars), 1)
        avatar_props = avatars[0]["props"]
        self.assertEqual(
            avatar_props.get("src"), "https://example.com/header-avatar.png"
        )

    def test_compose_basic(self):
        """Compose pattern with mixed molecules and organisms."""
        spec = {
            "pattern": "compose",
            "title": "Dashboard",
            "body": [
                {"use": "text_block", "content": "Welcome"},
                {
                    "use": "metrics_row",
                    "metrics": [
                        {"label": "CPU", "value": "42%"},
                        {"label": "Mem", "value": "2.1GB"},
                    ],
                },
                {"use": "divider"},
                {
                    "use": "action_row",
                    "actions": [
                        {
                            "label": "Refresh",
                            "action": "refresh",
                            "variant": "primary",
                        }
                    ],
                },
            ],
        }
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        v_code, v_out, _ = self.validate_output(out)
        self.assertEqual(v_code, 0, f"validate failed: {v_out}")
        self.assertIn("Validation Result: PASS", v_out)

    def test_compose_all_molecules(self):
        """Every molecule block composes and validates."""
        spec = {
            "pattern": "compose",
            "title": "All Molecules",
            "body": [
                {"use": "labeled_field", "label": "Name", "name": "name"},
                {"use": "action_row", "actions": [{"label": "Go", "action": "go"}]},
                {"use": "key_value", "key": "Version", "value": "1.0"},
                {"use": "metric_card", "label": "CPU", "value": "73%"},
                {"use": "status_badge", "label": "Online", "status": "ok"},
                {"use": "avatar_header", "name": "Souta"},
                {"use": "empty_state", "title": "Nothing here"},
                {"use": "alert_box", "message": "Heads up!"},
                {"use": "search_box", "name": "q"},
                {"use": "divider"},
                {"use": "text_block", "content": "Hello"},
                {"use": "markdown_block", "content": "## Hi"},
                {
                    "use": "chart_with_header",
                    "title": "Revenue",
                    "variant": "line",
                    "data": [{"month": "Jan", "revenue": 100}],
                },
                {
                    "use": "chart_legend_card",
                    "label": "Revenue",
                    "value": "$4,200",
                    "color": "#7CFF00",
                },
                {"use": "chart_stat_row", "label": "Total", "value": "$24,000"},
            ],
        }
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        v_code, v_out, _ = self.validate_output(out)
        self.assertEqual(v_code, 0, f"validate failed: {v_out}")
        self.assertIn("Validation Result: PASS", v_out)

    def test_compose_all_organisms(self):
        """Every organism block composes and validates."""
        spec = {
            "pattern": "compose",
            "title": "All Organisms",
            "body": [
                {
                    "use": "form_section",
                    "fields": [{"name": "x", "label": "X", "type": "text"}],
                },
                {"use": "data_table", "columns": [{"key": "a"}], "rows": [{"a": "1"}]},
                {"use": "metrics_row", "metrics": [{"label": "M", "value": "1"}]},
                {"use": "detail_section", "fields": [{"label": "K", "value": "V"}]},
                {
                    "use": "settings_group",
                    "title": "G",
                    "settings": [{"name": "s", "label": "S", "type": "toggle"}],
                },
                {"use": "chat_log", "messages": [{"sender": "A", "content": "hi"}]},
                {"use": "terminal_panel", "lines": ["$ echo hi"]},
                {
                    "use": "step_tracker",
                    "steps": [{"label": "Build", "status": "complete"}],
                },
                {"use": "media_grid", "items": [{"src": "https://example.com/1.png"}]},
                {"use": "chart_panel", "variant": "bar", "data": [{"x": 1, "y": 2}]},
                {
                    "use": "chart_dashboard",
                    "charts": [
                        {
                            "title": "CPU",
                            "variant": "line",
                            "data": [{"t": 1, "v": 50}],
                        }
                    ],
                },
                {
                    "use": "chart_detail",
                    "title": "Revenue",
                    "variant": "bar",
                    "data": [{"q": "Q1", "rev": 100}],
                    "stats": [{"label": "Total", "value": "$100"}],
                },
                {"use": "list_section", "items": [{"primary": "Item 1"}]},
            ],
        }
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        v_code, v_out, _ = self.validate_output(out)
        self.assertEqual(v_code, 0, f"validate failed: {v_out}")
        self.assertIn("Validation Result: PASS", v_out)

    def test_compose_missing_body(self):
        """Compose pattern requires body array."""
        spec = {"pattern": "compose", "title": "Empty"}
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "MISSING_FIELD")

    def test_compose_unknown_block(self):
        """Unknown block name in body raises error."""
        spec = {
            "pattern": "compose",
            "title": "Bad",
            "body": [{"use": "nonexistent_widget"}],
        }
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "BLOCK_NOT_FOUND")

    def test_compose_chart_blocks(self):
        """Chart molecules and organisms compose and validate."""
        spec = {
            "pattern": "compose",
            "title": "Chart Blocks",
            "body": [
                {
                    "use": "chart_dashboard",
                    "metrics": [{"label": "Users", "value": "1.2k"}],
                    "charts": [
                        {
                            "title": "Trend A",
                            "variant": "line",
                            "data": [
                                {"x": "Jan", "y": 10},
                                {"x": "Feb", "y": 20},
                            ],
                        },
                        {
                            "title": "Trend B",
                            "variant": "bar",
                            "data": [{"x": "Q1", "y": 30}],
                        },
                    ],
                    "columns": 2,
                    "actions": [{"label": "Export", "action": "export"}],
                },
                {"use": "divider"},
                {
                    "use": "chart_detail",
                    "title": "Revenue",
                    "variant": "area",
                    "data": [
                        {"month": "Jan", "revenue": 4200},
                        {"month": "Feb", "revenue": 5100},
                    ],
                    "xKey": "month",
                    "series": ["revenue"],
                    "stats": [
                        {"label": "Total", "value": "$9,300"},
                        {"label": "Average", "value": "$4,650"},
                    ],
                    "actions": [{"label": "Download", "action": "download_csv"}],
                },
                {
                    "use": "chart_legend_card",
                    "label": "Revenue",
                    "value": "$9,300",
                    "color": "#7CFF00",
                    "trend": "+12%",
                },
                {
                    "use": "chart_legend_card",
                    "label": "Cost",
                    "value": "$5,200",
                    "color": "#00D4AA",
                },
                {"use": "chart_stat_row", "label": "Profit Margin", "value": "44%"},
                {
                    "use": "chart_with_header",
                    "title": "Simple Chart",
                    "variant": "pie",
                    "data": [{"cat": "A", "val": 60}, {"cat": "B", "val": 40}],
                    "badge": "Live",
                },
            ],
        }
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        v_code, v_out, _ = self.validate_output(out)
        self.assertEqual(v_code, 0, f"validate failed: {v_out}")
        self.assertIn("Validation Result: PASS", v_out)

    def test_terminal_output_normalizes_reserved_close_actions(self):
        spec = {
            "pattern": "terminal_output",
            "title": "Build Log",
            "lines": ["$ cargo build", "Finished release"],
            "actions": [
                {"label": "Close", "action": "close"},
                {"label": "Dismiss", "action": "eidou:close"},
            ],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        buttons = self.find_nodes(data, "button")
        self.assertEqual(len(buttons), 2)
        actions = [button["props"]["action"] for button in buttons]
        self.assertEqual(actions, ["_eidou_sys_close", "_eidou_sys_close"])

    def test_terminal_output_close_label_without_action_uses_reserved_close(self):
        spec = {
            "pattern": "terminal_output",
            "title": "Build Log",
            "lines": ["$ cargo build", "Finished release"],
            "actions": [
                {"label": "Close", "variant": "secondary"},
                {"label": "Refresh", "action": "refresh"},
            ],
        }

        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        buttons = self.find_nodes(data, "button")
        self.assertEqual(len(buttons), 2)
        close_button = next(
            button for button in buttons if button["props"].get("label") == "Close"
        )
        refresh_button = next(
            button for button in buttons if button["props"].get("label") == "Refresh"
        )
        self.assertEqual(close_button["props"].get("action"), "_eidou_sys_close")
        self.assertEqual(refresh_button["props"].get("action"), "refresh")

    def test_unknown_pattern(self):
        spec = {"pattern": "fancy_table", "title": "Nope"}
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 2)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "PATTERN_NOT_FOUND")
        self.assertEqual(payload["stage"], "pattern_selection")

    def test_media_gallery_uses_ratio_default_size(self):
        spec = {
            "pattern": "media_gallery",
            "title": "Gallery",
            "items": [{"src": "https://example.com/1.png"}],
        }
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        data = json.loads(out)
        self.assertEqual(
            data["props"]["size"],
            {
                "ratio": "16:9",
                "width": 1024,
                "maxWidth": 1200,
                "base": "lg",
            },
        )

    def test_missing_required_field(self):
        spec = {"pattern": "form", "title": "Missing fields"}
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "MISSING_FIELD")
        self.assertEqual(payload["stage"], "spec_validation")

    def test_invalid_json(self):
        code, _, err = self.run_compose('{"pattern":"message"')
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "INVALID_JSON")
        self.assertEqual(payload["stage"], "input_parse")


class TestLayoutPresets(unittest.TestCase):
    """P008: Layout Presets & Slot System."""

    def run_compose(self, payload):
        process = subprocess.Popen(
            [sys.executable, COMPOSE_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=payload)
        return process.returncode, stdout, stderr

    def validate_output(self, ui_json):
        process = subprocess.Popen(
            [sys.executable, VALIDATE_PATH, "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=ui_json)
        return process.returncode, stdout, stderr

    def compose_and_validate(self, spec):
        """Helper: compose + validate, return parsed EUIP."""
        code, out, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 0, f"compose failed: {err}")
        v_code, v_out, _ = self.validate_output(out)
        self.assertEqual(v_code, 0, f"validate failed: {v_out}")
        self.assertIn("Validation Result: PASS", v_out)
        return json.loads(out)

    def find_nodes(self, node, target_type):
        """Recursively find all nodes of a given type."""
        found = []
        if not isinstance(node, dict):
            return found
        if node.get("type") == target_type:
            found.append(node)
        for child in node.get("children", []):
            found.extend(self.find_nodes(child, target_type))
        return found

    # --- Layout Preset Validity Tests ---

    def test_stack_layout_default(self):
        """stack layout (default) produces valid EUIP."""
        spec = {
            "pattern": "compose",
            "title": "Stack Test",
            "body": [
                {"use": "text_block", "content": "Hello"},
                {"use": "text_block", "content": "World"},
            ],
        }
        self.compose_and_validate(spec)

    def test_sidebar_layout(self):
        """sidebar layout produces valid EUIP with grid structure."""
        spec = {
            "pattern": "compose",
            "title": "Sidebar Test",
            "layout": "sidebar",
            "body": [
                {"slot": "main", "use": "text_block", "content": "Main content"},
                {"slot": "side", "use": "metric_card", "label": "CPU", "value": "42%"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0, "sidebar layout should contain a grid")
        grid_node = grids[0]
        self.assertEqual(grid_node["props"]["columns"], 3)
        self.assertEqual(grid_node["props"].get("_style", {}).get("minHeight"), "100%")

    def test_split_layout(self):
        """split layout produces valid EUIP."""
        spec = {
            "pattern": "compose",
            "title": "Split Test",
            "layout": "split",
            "body": [
                {"slot": "left", "use": "text_block", "content": "Left"},
                {"slot": "right", "use": "text_block", "content": "Right"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        self.assertEqual(grids[0]["props"]["columns"], 2)

    def test_grid_2x2_layout(self):
        """grid-2x2 layout produces valid EUIP."""
        spec = {
            "pattern": "compose",
            "title": "Grid 2x2 Test",
            "layout": "grid-2x2",
            "body": [
                {"slot": "slot-a", "use": "metric_card", "label": "A", "value": "1"},
                {"slot": "slot-b", "use": "metric_card", "label": "B", "value": "2"},
                {"slot": "slot-c", "use": "metric_card", "label": "C", "value": "3"},
                {"slot": "slot-d", "use": "metric_card", "label": "D", "value": "4"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        self.assertEqual(grids[0]["props"]["columns"], 2)

    def test_bento_layout(self):
        """bento layout produces valid EUIP with correct spans."""
        spec = {
            "pattern": "compose",
            "title": "Bento Test",
            "layout": "bento",
            "body": [
                {
                    "slot": "slot-a",
                    "use": "chart_panel",
                    "variant": "pie",
                    "data": [{"cat": "A", "val": 60}, {"cat": "B", "val": 40}],
                },
                {
                    "slot": "slot-b",
                    "use": "metric_card",
                    "label": "Users",
                    "value": "1.2k",
                },
                {
                    "slot": "slot-c",
                    "use": "metric_card",
                    "label": "Revenue",
                    "value": "$4k",
                },
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        grid_node = grids[0]
        self.assertEqual(grid_node["props"]["columns"], 3)
        self.assertEqual(grid_node["props"].get("_style", {}).get("minHeight"), "100%")
        # Check slot-a spans 2 cols (no row span -- side flows naturally)
        first_child = grid_node["children"][0]
        self.assertEqual(first_child["props"]["_style"]["gridColumn"], "span 2")
        self.assertNotIn("gridRow", first_child["props"]["_style"])
        # slot-b and slot-c merge into a single side col
        self.assertEqual(len(grid_node["children"]), 2)
        side_col = grid_node["children"][1]
        self.assertEqual(side_col["type"], "col")

    def test_hero_layout(self):
        """hero layout produces valid EUIP."""
        spec = {
            "pattern": "compose",
            "title": "Hero Test",
            "layout": "hero",
            "body": [
                {
                    "slot": "hero",
                    "use": "chart_panel",
                    "variant": "line",
                    "data": [{"x": 1, "y": 2}, {"x": 2, "y": 4}],
                },
                {
                    "slot": "content",
                    "use": "text_block",
                    "content": "Description below",
                },
            ],
        }
        self.compose_and_validate(spec)

    def test_triple_layout(self):
        """triple layout produces valid EUIP."""
        spec = {
            "pattern": "compose",
            "title": "Triple Test",
            "layout": "triple",
            "body": [
                {"slot": "left", "use": "metric_card", "label": "A", "value": "1"},
                {"slot": "center", "use": "metric_card", "label": "B", "value": "2"},
                {"slot": "right", "use": "metric_card", "label": "C", "value": "3"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        self.assertEqual(grids[0]["props"]["columns"], 3)

    def test_dashboard_layout(self):
        """dashboard layout produces valid EUIP with metrics row."""
        spec = {
            "pattern": "compose",
            "title": "Dashboard Test",
            "layout": "dashboard",
            "body": [
                {
                    "slot": "metrics",
                    "use": "metric_card",
                    "label": "CPU",
                    "value": "42%",
                },
                {
                    "slot": "metrics",
                    "use": "metric_card",
                    "label": "RAM",
                    "value": "8GB",
                },
                {
                    "slot": "main",
                    "use": "chart_panel",
                    "variant": "line",
                    "data": [{"t": 1, "v": 50}],
                },
                {"slot": "footer", "use": "text_block", "content": "Last updated: now"},
            ],
        }
        data = self.compose_and_validate(spec)
        # metrics slot should produce a row
        rows = self.find_nodes(data, "row")
        has_metrics_row = any(len(r.get("children", [])) >= 2 for r in rows)
        self.assertTrue(has_metrics_row, "dashboard should have a metrics row")

    # --- Slot Behavior Tests ---

    def test_multiple_blocks_same_slot(self):
        """Multiple blocks in same slot stack vertically."""
        spec = {
            "pattern": "compose",
            "title": "Multi-Slot",
            "layout": "sidebar",
            "body": [
                {"slot": "main", "use": "text_block", "content": "First"},
                {"slot": "main", "use": "text_block", "content": "Second"},
                {"slot": "side", "use": "metric_card", "label": "X", "value": "1"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        main_col = grids[0]["children"][0]
        # main col should have 2 text blocks
        texts = self.find_nodes(main_col, "text")
        text_contents = [t["props"]["content"] for t in texts]
        self.assertIn("First", text_contents)
        self.assertIn("Second", text_contents)

    def test_unknown_slot_error(self):
        """Unknown slot name produces UNKNOWN_SLOT error."""
        spec = {
            "pattern": "compose",
            "title": "Bad Slot",
            "layout": "sidebar",
            "body": [
                {"slot": "nonexistent", "use": "text_block", "content": "Oops"},
            ],
        }
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "UNKNOWN_SLOT")

    def test_no_slot_defaults_to_first(self):
        """Blocks without slot go to the first slot of the layout."""
        spec = {
            "pattern": "compose",
            "title": "Default Slot",
            "layout": "sidebar",
            "body": [
                {"use": "text_block", "content": "Should go to main"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        # main col (first child of grid) should have the text
        main_col = grids[0]["children"][0]
        texts = self.find_nodes(main_col, "text")
        contents = [t["props"]["content"] for t in texts]
        self.assertIn("Should go to main", contents)

    def test_empty_slot_omitted(self):
        """Empty slots are omitted from output."""
        spec = {
            "pattern": "compose",
            "title": "Empty Slot",
            "layout": "split",
            "body": [
                {"slot": "left", "use": "text_block", "content": "Only left"},
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        # Grid should only have 1 child (left col), right is omitted
        self.assertEqual(len(grids[0]["children"]), 1)

    # --- Unknown Layout Tests ---

    def test_unknown_layout_error(self):
        """Unknown layout name produces UNKNOWN_LAYOUT error."""
        spec = {
            "pattern": "compose",
            "title": "Bad Layout",
            "layout": "fancy_grid_9000",
            "body": [{"use": "text_block", "content": "hi"}],
        }
        code, _, err = self.run_compose(json.dumps(spec))
        self.assertEqual(code, 1)
        payload = json.loads(err)
        self.assertEqual(payload["error"], "UNKNOWN_LAYOUT")

    # --- Size Preset Tests ---

    def test_semantic_size_dashboard(self):
        """dashboard size preset resolves to ratio object."""
        spec = {
            "pattern": "compose",
            "title": "Size Test",
            "size": "dashboard",
            "body": [{"use": "text_block", "content": "hi"}],
        }
        data = self.compose_and_validate(spec)
        self.assertEqual(
            data["props"]["size"],
            {"ratio": "16:9", "width": 1024, "maxWidth": 1200},
        )

    def test_semantic_size_compact(self):
        """compact size preset resolves to 'sm'."""
        spec = {
            "pattern": "compose",
            "title": "Compact Test",
            "size": "compact",
            "body": [{"use": "text_block", "content": "hi"}],
        }
        data = self.compose_and_validate(spec)
        self.assertEqual(data["props"]["size"], "sm")

    def test_explicit_size_overrides_layout_default(self):
        """Explicit size in spec overrides layout's default size."""
        spec = {
            "pattern": "compose",
            "title": "Override Test",
            "layout": "sidebar",
            "size": "compact",
            "body": [
                {"slot": "main", "use": "text_block", "content": "hi"},
            ],
        }
        data = self.compose_and_validate(spec)
        # sidebar default is "dashboard", but explicit "compact" -> "sm"
        self.assertEqual(data["props"]["size"], "sm")

    def test_explicit_hybrid_size_overrides_layout_default(self):
        """Explicit hybrid object size in spec overrides layout default size."""
        spec = {
            "pattern": "compose",
            "title": "Hybrid Override",
            "layout": "sidebar",
            "size": {"width": 900, "height": "auto"},
            "body": [
                {"slot": "main", "use": "text_block", "content": "hi"},
            ],
        }
        data = self.compose_and_validate(spec)
        self.assertEqual(data["props"]["size"], {"width": 900, "height": "auto"})

    def test_layout_default_size_applied(self):
        """Layout's default size is used when no explicit size given."""
        spec = {
            "pattern": "compose",
            "title": "Default Size",
            "layout": "sidebar",
            "body": [
                {"slot": "main", "use": "text_block", "content": "hi"},
            ],
        }
        data = self.compose_and_validate(spec)
        # sidebar default is hybrid fit-content sizing
        self.assertEqual(
            data["props"]["size"],
            {"width": 1024, "height": "auto"},
        )

    def test_unknown_size_passthrough(self):
        """Unknown size string passes through as-is."""
        spec = {
            "pattern": "compose",
            "title": "Passthrough",
            "size": "lg",
            "body": [{"use": "text_block", "content": "hi"}],
        }
        data = self.compose_and_validate(spec)
        self.assertEqual(data["props"]["size"], "lg")

    # --- Integration Tests ---

    def test_sidebar_chart_and_metrics(self):
        """Full sidebar layout with chart + metrics (integration)."""
        spec = {
            "pattern": "compose",
            "title": "Market Analysis",
            "layout": "sidebar",
            "size": "dashboard",
            "body": [
                {
                    "slot": "main",
                    "use": "chart_panel",
                    "variant": "pie",
                    "data": [
                        {"product": "Alpha", "share": 45},
                        {"product": "Beta", "share": 30},
                        {"product": "Gamma", "share": 25},
                    ],
                },
                {
                    "slot": "side",
                    "use": "metric_card",
                    "label": "Total Products",
                    "value": "3",
                },
                {
                    "slot": "side",
                    "use": "metric_card",
                    "label": "Market Leader",
                    "value": "Alpha (45%)",
                },
            ],
        }
        data = self.compose_and_validate(spec)
        # Should have grid with 3 columns
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        self.assertEqual(grids[0]["props"]["columns"], 3)
        # Should have a chart node
        charts = self.find_nodes(data, "chart")
        self.assertEqual(len(charts), 1)

    def test_bento_dashboard_integration(self):
        """Full bento layout with chart + 2 metric cards (integration)."""
        spec = {
            "pattern": "compose",
            "title": "Bento Dashboard",
            "layout": "bento",
            "body": [
                {
                    "slot": "slot-a",
                    "use": "chart_panel",
                    "variant": "area",
                    "data": [
                        {"month": "Jan", "revenue": 4200},
                        {"month": "Feb", "revenue": 5100},
                    ],
                },
                {
                    "slot": "slot-b",
                    "use": "metric_card",
                    "label": "Total Revenue",
                    "value": "$9,300",
                },
                {
                    "slot": "slot-c",
                    "use": "metric_card",
                    "label": "Growth",
                    "value": "+21%",
                },
            ],
        }
        data = self.compose_and_validate(spec)
        grids = self.find_nodes(data, "grid")
        self.assertTrue(len(grids) > 0)
        # slot-a should span 2 cols (no row span)
        slot_a = grids[0]["children"][0]
        self.assertEqual(slot_a["props"]["_style"]["gridColumn"], "span 2")
        self.assertNotIn("gridRow", slot_a["props"]["_style"])
        # slot-b + slot-c merged into single side col
        self.assertEqual(len(grids[0]["children"]), 2)

    def test_grid_layout_slots_vertically_centered(self):
        """Featured panels may be vertically centered; info flows top-aligned."""
        # Bento: slot-a (featured) = center; side col (b+c merged) = start
        bento_spec = {
            "pattern": "compose",
            "title": "Bento VCenter",
            "layout": "bento",
            "body": [
                {"slot": "slot-a", "use": "text_block", "content": "A"},
                {"slot": "slot-b", "use": "text_block", "content": "B"},
                {"slot": "slot-c", "use": "text_block", "content": "C"},
            ],
        }
        bento_data = self.compose_and_validate(bento_spec)
        bento_grid = self.find_nodes(bento_data, "grid")[0]
        slot_a = bento_grid["children"][0]
        self.assertEqual(slot_a["props"]["_style"].get("alignSelf"), "center")
        # Side col (merged slot-b + slot-c) should NOT be centered
        side_col = bento_grid["children"][1]
        self.assertNotEqual(
            side_col["props"].get("justify"),
            "center",
            "Side col should not be centered",
        )

        # Sidebar: main centers only when it's a single chart panel
        sidebar_text_spec = {
            "pattern": "compose",
            "title": "Sidebar Text",
            "layout": "sidebar",
            "body": [
                {"slot": "main", "use": "text_block", "content": "Main"},
                {"slot": "side", "use": "text_block", "content": "Side"},
            ],
        }
        sidebar_text_data = self.compose_and_validate(sidebar_text_spec)
        sidebar_text_grid = self.find_nodes(sidebar_text_data, "grid")[0]
        main_slot = sidebar_text_grid["children"][0]
        self.assertNotEqual(main_slot["props"]["_style"].get("alignSelf"), "center")

        sidebar_chart_spec = {
            "pattern": "compose",
            "title": "Sidebar Chart",
            "layout": "sidebar",
            "body": [
                {
                    "slot": "main",
                    "use": "chart_panel",
                    "variant": "line",
                    "data": [{"x": 1, "y": 2}, {"x": 2, "y": 4}],
                },
                {"slot": "side", "use": "text_block", "content": "Side"},
            ],
        }
        sidebar_chart_data = self.compose_and_validate(sidebar_chart_spec)
        sidebar_chart_grid = self.find_nodes(sidebar_chart_data, "grid")[0]
        main_slot = sidebar_chart_grid["children"][0]
        self.assertEqual(main_slot["props"]["_style"].get("alignSelf"), "center")

        # Split: both equal, no center
        split_spec = {
            "pattern": "compose",
            "title": "Split VCenter",
            "layout": "split",
            "body": [
                {"slot": "left", "use": "text_block", "content": "L"},
                {"slot": "right", "use": "text_block", "content": "R"},
            ],
        }
        split_data = self.compose_and_validate(split_spec)
        split_grid = self.find_nodes(split_data, "grid")[0]
        for child in split_grid["children"]:
            self.assertNotEqual(child["props"].get("justify"), "center")

        # Grid 2x2: all equal, no center
        g2x2_spec = {
            "pattern": "compose",
            "title": "Grid2x2 VCenter",
            "layout": "grid-2x2",
            "body": [
                {"slot": "slot-a", "use": "text_block", "content": "A"},
                {"slot": "slot-b", "use": "text_block", "content": "B"},
                {"slot": "slot-c", "use": "text_block", "content": "C"},
                {"slot": "slot-d", "use": "text_block", "content": "D"},
            ],
        }
        g2x2_data = self.compose_and_validate(g2x2_spec)
        g2x2_grid = self.find_nodes(g2x2_data, "grid")[0]
        for child in g2x2_grid["children"]:
            self.assertNotEqual(child["props"].get("justify"), "center")

        # Triple: all equal, no center
        triple_spec = {
            "pattern": "compose",
            "title": "Triple VCenter",
            "layout": "triple",
            "body": [
                {"slot": "left", "use": "text_block", "content": "L"},
                {"slot": "center", "use": "text_block", "content": "C"},
                {"slot": "right", "use": "text_block", "content": "R"},
            ],
        }
        triple_data = self.compose_and_validate(triple_spec)
        triple_grid = self.find_nodes(triple_data, "grid")[0]
        for child in triple_grid["children"]:
            self.assertNotEqual(child["props"].get("justify"), "center")


if __name__ == "__main__":
    unittest.main()
