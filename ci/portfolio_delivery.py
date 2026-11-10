"""Non-secret image-reference helpers for the portfolio GitOps publisher."""
import os
from pathlib import Path
import re

REPOSITORY = 'noelnovo/nn-portfolio'
PULL_IMAGE = 'registry.int.downops.win/' + REPOSITORY


def update_manifest(text, tag):
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*-[0-9a-f]{7,40}', tag) or len(tag) > 128:
        raise ValueError('An immutable version-and-commit tag is required')
    pattern = r'(?m)^(\s*image:\s*)' + re.escape(PULL_IMAGE) + r':[^\s]+$'
    updated, count = re.subn(pattern, lambda match: match.group(1) + PULL_IMAGE + ':' + tag, text)
    if count != 1:
        raise ValueError('Expected exactly one canonical portfolio image reference')
    return updated


def main():
    manifest = Path('k8s/app.yaml')
    manifest.write_text(update_manifest(manifest.read_text(), os.environ['TAG']))
    print('portfolio-image-reference-updated')


if __name__ == '__main__':
    main()
