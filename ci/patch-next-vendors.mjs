// Next 16.4.6 still vendors vulnerable picomatch 4.0.1, semver 7.3.2 and
// send 0.18.0 (vercel/next.js tag v16.4.6, packages/next/package.json/taskfile.js).
// Copy actual lockfile-verified patched npm packages, never fake version labels
// or exclude components from the SBOM. Keep each library on its compatible line.
import {cpSync, lstatSync, readFileSync, realpathSync, rmSync} from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const application = readJson(path.join(root, 'package.json'));
const nextRoot = path.join(root, 'node_modules', 'next');
const next = readJson(path.join(nextRoot, 'package.json'));
if (next.version !== '16.4.6' || application.dependencies.next !== next.version) {
  throw new Error('Review vendor patches before changing the pinned Next release');
}
const compiledRoot = path.join(nextRoot, 'dist', 'compiled');
if (realpathSync(compiledRoot) !== compiledRoot) {
  throw new Error('Compiled dependency root must not be a symlink');
}

function verifiedReplacement(name) {
  const alias = `next-patched-${name}`;
  const prefix = `npm:${name}@`;
  const spec = application.dependencies[alias];
  if (!spec?.startsWith(prefix) || !/^\d+\.\d+\.\d+$/.test(spec.slice(prefix.length))) {
    throw new Error('An exact patched npm alias is required');
  }
  const source = path.join(root, 'node_modules', alias);
  const target = path.join(compiledRoot, name);
  if (lstatSync(source).isSymbolicLink() || lstatSync(target).isSymbolicLink()) {
    throw new Error('Vendor source and destination must be physical directories');
  }
  const installed = readJson(path.join(source, 'package.json'));
  const original = readJson(path.join(target, 'package.json'));
  if (installed.name !== name || original.name !== name || installed.version !== spec.slice(prefix.length)) {
    throw new Error('Installed package identity does not match the reviewed alias');
  }
  return {name, source, target, version: installed.version};
}

// Validate every input before making the first physical replacement.
const replacements = ['picomatch', 'semver', 'send'].map(verifiedReplacement);
for (const replacement of replacements) {
  rmSync(replacement.target, {recursive: true});
  cpSync(replacement.source, replacement.target, {recursive: true, dereference: true});
}
console.log(JSON.stringify({patchedNextVendorPackages: replacements.map(({name, version}) => ({name, version}))}));
