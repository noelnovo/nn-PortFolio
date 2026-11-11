"""Guard real runtime dependency fixes while retaining the standalone contract."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VENDORS = ['picomatch', 'semver', 'send', 'debug', 'fresh', 'nanoid', 'ws']
ENTRY_FILES = {
    'picomatch': ['index.js'], 'semver': ['index.js'], 'send': ['index.js'],
    'debug': ['src/index.js', 'src/node.js', 'src/common.js'], 'fresh': ['index.js'],
    'nanoid': ['index.cjs', 'non-secure/index.cjs', 'url-alphabet/index.cjs'],
    'ws': ['index.js', 'lib/websocket.js', 'lib/websocket-server.js'],
}


class RuntimeDependencySecurityTests(unittest.TestCase):
    def test_new_vendor_aliases_are_exact_runtime_packages_with_locked_integrity(self):
        package = json.loads((ROOT / 'package.json').read_text())
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        for name, version in [('nanoid', '3.3.18'), ('ws', '8.21.0')]:
            alias = 'next-patched-' + name
            spec = f'npm:{name}@{version}'
            self.assertEqual(package['dependencies'][alias], spec)
            self.assertEqual(lock['packages']['']['dependencies'][alias], spec)
            installed = lock['packages']['node_modules/' + alias]
            self.assertEqual((installed['name'], installed['version']), (name, version))
            self.assertTrue(installed['integrity'].startswith('sha512-'))
            self.assertFalse(installed.get('dev', False))
            self.assertFalse(installed.get('dependencies', {}))
            self.assertFalse(installed.get('optionalDependencies', {}))

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
        self.assertEqual(dockerfile.count('node@sha256:'), 2)
        self.assertIn('FROM security-tests AS builder', dockerfile)
        self.assertIn('FROM scratch AS security-coverage', dockerfile)
        self.assertIn('RUN npm ci && node ci/patch-next-vendors.mjs', dockerfile)
        self.assertIn('RUN node /tmp/portfolio-runtime-smoke.cjs && rm /tmp/portfolio-runtime-smoke.cjs', runner)

    def test_real_coverage_is_collected_and_sent_through_reviewed_shared_workflow(self):
        package = json.loads((ROOT / 'package.json').read_text())
        command = package['scripts']['test:build-tools']
        self.assertIn('node --test ci/test_build_tools.cjs', command)
        self.assertIn('--reporter=lcov', command)
        self.assertIn('--check-coverage --lines=90 --functions=90 --branches=80', command)
        caller = (ROOT / '.github/workflows/security.yml').read_text()
        self.assertIn('dependency-track-scan.yml@1af9e3f4564e160ba6e3dc0b495738c3c069254d', caller)
        self.assertNotIn('secrets: inherit', caller)


@unittest.skipUnless(shutil.which('node'), 'Synthetic vendor replacement requires Node')
class VendorReplacementTests(unittest.TestCase):
    def fixture(self, root):
        package = json.loads((ROOT / 'package.json').read_text())
        (root / 'package.json').write_text(json.dumps(package))
        next_root = root / 'node_modules/next'
        next_root.mkdir(parents=True)
        (next_root / 'package.json').write_text('{"name":"next","version":"16.4.6"}')
        for name in VENDORS:
            alias = 'next-patched-' + name
            source = root / 'node_modules' / alias
            source.mkdir()
            version = package['dependencies'][alias].split('@')[-1]
            metadata = {'name': name, 'version': version}
            if name not in ['send', 'fresh']:
                metadata['main'] = ENTRY_FILES[name][0]
            if name == 'nanoid':
                metadata['exports'] = {'.': {'require': {'default': './index.cjs'}},
                                       './non-secure': {'require': {'default': './non-secure/index.cjs'}}}
            if name == 'ws':
                metadata['exports'] = {'.': {'require': './index.js'}}
            (source / 'package.json').write_text(json.dumps(metadata))
            (source / 'index.js').write_text('patched-' + name)
            for entry in ENTRY_FILES[name]:
                file = source / entry
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('patched-' + name)
            target = next_root / 'dist/compiled' / name
            target.mkdir(parents=True)
            (target / 'package.json').write_text(json.dumps({'name': name}))
            (target / 'index.js').write_text('old-' + name)

    def run_patch(self, root):
        return subprocess.run(['node', str(ROOT / 'ci/patch-next-vendors.mjs')],
                              cwd=root, capture_output=True, timeout=30)

    def test_actual_package_code_and_metadata_are_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            self.assertEqual(self.run_patch(root).returncode, 0)
            for name in VENDORS:
                target = root / 'node_modules/next/dist/compiled' / name
                self.assertEqual((target / 'index.js').read_text(), 'patched-' + name)
                self.assertIn('version', json.loads((target / 'package.json').read_text()))

    def test_all_inputs_are_verified_before_any_package_is_modified(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'node_modules/next-patched-semver/package.json').write_text('{"name":"semver","version":"0.0.0"}')
            self.assertNotEqual(self.run_patch(root).returncode, 0)
            for name in VENDORS:
                self.assertEqual((root / 'node_modules/next/dist/compiled' / name / 'index.js').read_text(), 'old-' + name)

    def test_symlink_destination_cannot_delete_or_replace_outside_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            outside = root / 'retained'
            outside.mkdir()
            (outside / 'marker').write_text('keep')
            target = root / 'node_modules/next/dist/compiled/send'
            shutil.rmtree(target)
            target.symlink_to(outside, target_is_directory=True)
            self.assertNotEqual(self.run_patch(root).returncode, 0)
            self.assertEqual((outside / 'marker').read_text(), 'keep')


if __name__ == '__main__':unittest.main()
