#!/usr/bin/env python3
import textwrap
import argparse
import sys
import re

assert sys.version_info >= (3, 3), 'Use Python3, Luke'
indent_regex = re.compile(r'^(\s*([0-9]+\.\s+)|([\s\*\-\+]+))')


def wrap_file(filename, width=None):
    wrapped_lines = []
    with open(filename, 'r') as fp:
        for line in fp:
            wrapped_lines.append(_wrap_line(line, width=width))

    output = '\n'.join(wrapped_lines).strip() + '\n'
    return output


def wrap_text(text, width=None):
    lines = '\n'.split(text)
    wrapped_lines = [_wrap_line(line, width=width) for line in lines]
    output = '\n'.join(wrapped_lines).strip() + '\n'
    return output


def _wrap_line(line, width=80):
    lines = textwrap.wrap(line, width=width, subsequent_indent=_get_indent(line))
    return '\n'.join(lines)


def _get_indent(line):
    match = indent_regex.search(line)
    if not match:
        return ''

    group = match.group(1)
    return ' ' * len(group)


def main(args):
    output = wrap_file(args.source_file, width=args.width)
    sys.stdout.write(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source_file')
    parser.add_argument('--width', dest='width', type=int, default=80)
    args = parser.parse_args()
    main(args)
