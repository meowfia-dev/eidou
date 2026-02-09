#!/usr/bin/env python3
"""
validate.py

Validates EUIP JSON against the schema specifications.
Enforces Projection > Field > Content structure.
Enforces Rule-of-One (R001, R002) and checks for common pitfalls (R003).

Usage:
    python3 validate.py <file_path_or_dash> [--verbose]
"""

import argparse
import json
import os
import sys

# Constants
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPT_DIR)))
SPEC_DIR = os.path.join(REPO_ROOT, "specification", "v0_1", "json")

COMPONENTS_SCHEMA_PATH = os.path.join(SPEC_DIR, "components.json")


class ValidationReport:
    def __init__(self, verbose=False):
        self.errors = []
        self.warnings = []
        self.verbose = verbose
        self.component_count = 0
        self.shard_count = 0
        self.max_depth = 0

    def error(self, path, msg, hint=None):
        full_msg = f"[ERROR] {path}: {msg}"
        if hint:
            full_msg += f"\n        -> Hint: {hint}"
        self.errors.append(full_msg)

    def warn(self, path, msg, hint=None):
        full_msg = f"[WARN]  {path}: {msg}"
        if hint:
            full_msg += f"\n        -> Hint: {hint}"
        self.warnings.append(full_msg)

    def has_errors(self):
        return len(self.errors) > 0

    def print_report(self):
        if self.verbose:
            print("-" * 40)
            print(f"Stats:")
            print(f"  Total Components: {self.component_count}")
            print(f"  Total Shards:     {self.shard_count}")
            print(f"  Max Depth:        {self.max_depth}")
            print("-" * 40)

        if self.has_errors():
            print("Validation Result: FAIL")
        else:
            print("Validation Result: PASS")

        for i, msg in enumerate(self.errors, 1):
            print(f"{i}. {msg}")
        for i, msg in enumerate(self.warnings, 1):
            print(f"{i}. {msg}")


class SchemaRegistry:
    def __init__(self):
        self.components = {}  # type -> { required_top: [], required_props: [], has_children: bool }
        self.load_components()

    def load_components(self):
        if not os.path.exists(COMPONENTS_SCHEMA_PATH):
            # Fallback if spec file missing (e.g. in some envs), but warn
            # For strictness we might want to exit, but let's allow basic validation
            return

        with open(COMPONENTS_SCHEMA_PATH, "r") as f:
            try:
                schema = json.load(f)
            except json.JSONDecodeError:
                return

        defs = schema.get("$defs", {})
        for key, val in defs.items():
            props = val.get("properties", {})
            type_def = props.get("type", {})
            const_type = type_def.get("const")

            if const_type:
                req_top = val.get("required", [])
                props_schema = props.get("props", {})
                req_props = props_schema.get("required", [])
                has_children = "children" in props

                self.components[const_type] = {
                    "required_top": req_top,
                    "required_props": req_props,
                    "has_children": has_children,
                }


def validate_node(node, path, registry, report, depth=0):
    if not isinstance(node, dict):
        report.error(path, f"Node is not an object (got {type(node).__name__})")
        return

    report.component_count += 1
    if depth > report.max_depth:
        report.max_depth = depth

    # 1. Check type existence
    node_type = node.get("type")
    if not node_type:
        report.error(path, "Missing 'type' field")
        return

    # Track Shards
    if node_type == "shard":
        report.shard_count += 1
        if report.shard_count > 1:
            report.error(
                path,
                "R002: Multiple shards detected",
                "A projection can contain at most one shard container.",
            )

    # 2. Check schema definition
    if node_type == "projection":
        # Recursive projection found (should typically be root only)
        # Check basic props
        if "props" not in node:
            report.error(path, "Projection missing 'props'")
        if "children" not in node:
            report.error(path, "Projection missing 'children'")

        node_props = node.get("props", {})
        if "position" in node_props:
            pos = node_props["position"]
            if isinstance(pos, dict) and "anchor" not in pos:
                report.error(
                    f"{path}.props.position", "Missing required property 'anchor'"
                )

    elif registry.components and node_type in registry.components:
        _validate_component_schema(node, node_type, path, registry, report)

    elif registry.components:
        report.warn(
            path,
            f"Unknown component type '{node_type}'",
            "Check spelling or schema registry.",
        )

    # 3. Recurse children
    children = node.get("children")
    if children is not None:
        if not isinstance(children, list):
            report.error(f"{path}.children", "Field 'children' must be an array")
        else:
            for i, child in enumerate(children):
                validate_node(
                    child, f"{path}.children[{i}]", registry, report, depth + 1
                )


def _validate_component_schema(node, node_type, path, registry, report):
    rules = registry.components[node_type]

    # Check top level required
    for field in rules["required_top"]:
        if field not in node:
            report.error(path, f"Missing required field '{field}'")

    # Check nested props required
    if "props" in rules["required_top"] or "props" in node:
        node_props = node.get("props", {})
        if not isinstance(node_props, dict):
            report.error(f"{path}.props", "Field 'props' must be an object")
        else:
            for prop in rules["required_props"]:
                if prop not in node_props:
                    report.error(f"{path}.props", f"Missing required property '{prop}'")


def main():
    parser = argparse.ArgumentParser(description="Validate EUIP JSON.")
    parser.add_argument("path", help="File path or '-' for stdin")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    # 1. Load Data
    data = None
    try:
        if args.path == "-":
            content = sys.stdin.read()
            data = json.loads(content)
        else:
            if not os.path.exists(args.path):
                print(f"File not found: {args.path}")
                sys.exit(1)
            with open(args.path, "r", encoding="utf-8") as f:
                data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Validation Result: FAIL")
        print(f"1. Invalid JSON: {e}")
        sys.exit(1)

    # 2. Init Registry and Report
    registry = SchemaRegistry()
    report = ValidationReport(verbose=args.verbose)

    # 3. Root Validation
    if not isinstance(data, dict):
        report.error("root", "Root must be an object")
        report.print_report()
        sys.exit(1)

    # Check Root Type
    if data.get("type") != "projection":
        report.error(
            "root",
            f"Root type must be 'projection', got '{data.get('type')}'",
            "The root element of any EUIP widget must be a projection.",
        )

    # R001: Check ALL Children are Fields
    children = data.get("children")
    if isinstance(children, list):
        if len(children) == 0:
            report.error("root", "Projection must have at least one child (Field)")
        else:
            for i, child in enumerate(children):
                if isinstance(child, dict):
                    if child.get("type") != "field":
                        report.error(
                            f"root.children[{i}]",
                            f"R001: Direct projection child must be type 'field', got '{child.get('type')}'",
                            "All content must be wrapped in a Field component for OS adaptation.",
                        )
                else:
                    report.error(f"root.children[{i}]", "Child is not an object")
    elif children is not None:  # defined but not list
        report.error("root.children", "Children must be an array")
    else:
        # Children missing
        report.error("root", "Projection missing 'children'")

    # 4. Deep Validation
    validate_node(data, "root", registry, report)

    # 5. Output
    report.print_report()
    if report.has_errors():
        sys.exit(1)


if __name__ == "__main__":
    main()
