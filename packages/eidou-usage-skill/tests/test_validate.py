import unittest
import subprocess
import json
import os
import sys

SCRIPT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "scripts",
    "validate.py",
)


class TestValidate(unittest.TestCase):
    def run_validator(self, data):
        """Runs the validator script with JSON data passed via stdin."""
        process = subprocess.Popen(
            [sys.executable, SCRIPT_PATH, "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        stdout, stderr = process.communicate(input=json.dumps(data))
        return process.returncode, stdout, stderr

    def test_valid_hello_world(self):
        data = {
            "type": "projection",
            "props": {"title": "Test", "size": "sm", "position": {"anchor": "center"}},
            "children": [
                {
                    "type": "field",
                    "props": {"safeArea": True},
                    "children": [{"type": "text", "props": {"content": "Hello"}}],
                }
            ],
        }
        code, out, err = self.run_validator(data)
        self.assertEqual(code, 0, f"Validator failed for valid input: {out}")
        self.assertIn("Validation Result: PASS", out)

    def test_r001_projection_child_not_field(self):
        data = {
            "type": "projection",
            "props": {"title": "Test", "size": "sm", "position": {"anchor": "center"}},
            "children": [{"type": "text", "props": {"content": "I should be a field"}}],
        }
        code, out, err = self.run_validator(data)
        self.assertEqual(
            code, 1, "Validator should fail when projection child is not field"
        )
        self.assertIn("R001", out)

    def test_r002_multiple_shards(self):
        data = {
            "type": "projection",
            "props": {"title": "Test", "size": "sm", "position": {"anchor": "center"}},
            "children": [
                {
                    "type": "field",
                    "props": {},
                    "children": [
                        {
                            "type": "shard",
                            "props": {"title": "Shard 1"},
                            "children": [],
                        },
                        {
                            "type": "shard",
                            "props": {"title": "Shard 2"},
                            "children": [],
                        },
                    ],
                }
            ],
        }
        code, out, err = self.run_validator(data)
        self.assertEqual(code, 1, "Validator should fail with multiple shards")
        self.assertIn("R002", out)


if __name__ == "__main__":
    unittest.main()
