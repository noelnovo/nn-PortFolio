"""Guard real runtime dependency fixes while retaining the standalone contract."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RuntimeDependencySecurityTests(unittest.TestCase):
    def test_patched_next_and_matching_toolchain_are_locked(self):
        package = json.loads((ROOT / 'package.json').read_text())
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        self.assertEqual(package['dependencies']['next'], '16.4.6')
        self.assertEqual(package['devDependencies']['eslint-config-next'], '16.4.6')
        self.assertEqual(package['devDependencies']['@next/eslint-plugin-next'], '16.4.6')
        self.assertEqual(lock['packages']['node_modules/next']['version'], '16.4.6')
        sharp = tuple(map(int, lock['packages']['node_modules/sharp']['version'].split('.')))
        self.assertGreaterEqual(sharp, (0, 35, 5))

    def test_runtime_keeps_node_server_without_installer_dependency_trees(self):
        dockerfile = (ROOT / 'Dockerfile').read_text()
        runner = dockerfile.split(' AS runner\n', 1)[1]
        self.assertIn('rm -rf /usr/local/lib/node_modules/npm', runner)
        self.assertIn('/usr/local/lib/node_modules/corepack', runner)
        self.assertIn('/opt/yarn-v*', runner)
        self.assertIn('USER nextjs', runner)
        self.assertIn('CMD ["node", "server.js"]', runner)
        self.assertEqual(dockerfile.count('node:22-alpine@sha256:'), 3)


if __name__ == '__main__':unittest.main()
