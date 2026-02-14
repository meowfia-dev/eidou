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


if __name__ == "__main__":
    unittest.main()
