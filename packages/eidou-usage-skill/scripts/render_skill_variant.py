#!/usr/bin/env python3
"""Render platform-specific SKILL.md content from marker blocks."""

import argparse
import os
import sys


UNIX_START = "<!-- SKILL_VARIANT:unix:start -->"
UNIX_END = "<!-- SKILL_VARIANT:unix:end -->"
WINDOWS_START = "<!-- SKILL_VARIANT:windows:start -->"
WINDOWS_END = "<!-- SKILL_VARIANT:windows:end -->"


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render SKILL.md for unix or windows release packaging."
    )
    parser.add_argument("--input", required=True, help="Source SKILL.md path")
    parser.add_argument(
        "--target",
        required=True,
        choices=["unix", "windows"],
        help="Target platform variant",
    )
    parser.add_argument("--output", required=True, help="Rendered SKILL.md path")
    return parser.parse_args()


def render(lines, target):
    active_block = None
    include_line = True
    output = []
    marker_counts = {
        "unix_start": 0,
        "unix_end": 0,
        "windows_start": 0,
        "windows_end": 0,
    }

    for line in lines:
        stripped = line.strip()

        if stripped == UNIX_START:
            marker_counts["unix_start"] += 1
            if active_block is not None:
                fail("Nested marker blocks are not allowed")
            active_block = "unix"
            include_line = target == "unix"
            continue

        if stripped == UNIX_END:
            marker_counts["unix_end"] += 1
            if active_block != "unix":
                fail("Mismatched unix end marker")
            active_block = None
            include_line = True
            continue

        if stripped == WINDOWS_START:
            marker_counts["windows_start"] += 1
            if active_block is not None:
                fail("Nested marker blocks are not allowed")
            active_block = "windows"
            include_line = target == "windows"
            continue

        if stripped == WINDOWS_END:
            marker_counts["windows_end"] += 1
            if active_block != "windows":
                fail("Mismatched windows end marker")
            active_block = None
            include_line = True
            continue

        if include_line:
            output.append(line)

    if active_block is not None:
        fail("Unclosed marker block in source SKILL.md")

    if marker_counts["unix_start"] != marker_counts["unix_end"]:
        fail("Unbalanced unix marker blocks")
    if marker_counts["windows_start"] != marker_counts["windows_end"]:
        fail("Unbalanced windows marker blocks")
    if marker_counts["unix_start"] == 0 or marker_counts["windows_start"] == 0:
        fail("Expected both unix and windows marker blocks")

    return "".join(output)


def main():
    args = parse_args()

    if not os.path.isfile(args.input):
        fail("Input file does not exist: {}".format(args.input))

    with open(args.input, "r", encoding="utf-8") as source_file:
        source_lines = source_file.readlines()

    rendered = render(source_lines, args.target)

    output_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8", newline="") as output_file:
        output_file.write(rendered)


if __name__ == "__main__":
    main()
