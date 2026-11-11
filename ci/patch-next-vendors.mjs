// Next 16.4.6 still vendors vulnerable picomatch 4.0.1, semver 7.3.2 and
// send 0.18.0, plus bundled debug/fresh (verified against the lockfile-integrity
// checked Next tarball). Replace bundled code as well as ordinary dependencies.
// Copy actual lockfile-verified patched npm packages, never fake version labels
// or exclude components from the SBOM. Keep each library on its compatible line.
// Also replace bundled nanoid 3.1.32 and ws 8.2.3 on their existing major lines.
// Both replacements have no mandatory npm dependencies (crypto is built in;
// ws's native accelerators are optional and its JavaScript fallback is supported).
import {cpSync, lstatSync, readFileSync, readdirSync, realpathSync, rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACKAGE_MANIFEST = 'package.json';
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
// Reviewed CommonJS entry/closure files, not a generic package-exports resolver.
const requiredEntries = {
  picomatch: ['index.js'], semver: ['index.js'], send: ['index.js'],
  debug: ['src/index.js', 'src/node.js', 'src/common.js'], fresh: ['index.js'],
  nanoid: ['index.cjs', 'non-secure/index.cjs', 'url-alphabet/index.cjs'],
  ws: ['index.js', 'lib/websocket.js', 'lib/websocket-server.js'],
};

function verifyPhysicalTree(file) {
  const stat = lstatSync(file);
  if (stat.isDirectory()) {
    for (const name of readdirSync(file).sort()) verifyPhysicalTree(path.join(file, name));
  } else if (!stat.isFile()) {
    throw new Error('Vendor source must contain only physical directories and regular files');
  }
}

function verifyEntries(source, name, installed) {
  function entryPath(entry) {
    if (typeof entry !== 'string' || !entry || path.isAbsolute(entry)) {
      throw new Error('Invalid vendor entry path');
    }
    const file = path.resolve(source, entry);
    const relative = path.relative(source, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
      throw new Error('Vendor entry path escapes its package');
    }
    return file;
  }
  // Check containment of declared paths, including unused conditions/patterns,
  // but require actual files only for the reviewed runtime entry contracts.
  function verifyExportPaths(value) {
    if (typeof value === 'string') entryPath(value);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(verifyExportPaths);
    else if (value !== null) throw new Error('Invalid vendor export path');
  }
  if (installed.exports !== undefined) verifyExportPaths(installed.exports);
  const files = requiredEntries[name];
  const declared = [[installed.main ?? 'index.js', files[0]]];
  if (name === 'nanoid') {
    declared.push([installed.exports?.['.']?.require?.default, 'index.cjs'],
      [installed.exports?.['./non-secure']?.require?.default, 'non-secure/index.cjs']);
  }
  if (name === 'ws') declared.push([installed.exports?.['.']?.require, 'index.js']);
  for (const [entry, expected] of declared) {
    if (entryPath(entry) !== path.join(source, expected)) {
      throw new Error('Vendor entry does not match the reviewed contract');
    }
  }
  for (const entry of files) {
    const file = entryPath(entry);
    if (!lstatSync(file).isFile() || !readFileSync(file, 'utf8').trim()) {
      throw new Error('Vendor entry must be a nonempty regular file');
    }
  }
}
export function patchNextVendors(root) {
const application = readJson(path.join(root, PACKAGE_MANIFEST));
const nextRoot = path.join(root, 'node_modules', 'next');
const next = readJson(path.join(nextRoot, PACKAGE_MANIFEST));
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
  if (!lstatSync(source).isDirectory() || !lstatSync(target).isDirectory()) {
    throw new Error('Vendor source and destination must be physical directories');
  }
  verifyPhysicalTree(source);
  if (!lstatSync(path.join(target, PACKAGE_MANIFEST)).isFile()) {
    throw new Error('Vendor destination manifest must be a regular file');
  }
  const installed = readJson(path.join(source, PACKAGE_MANIFEST));
  const original = readJson(path.join(target, PACKAGE_MANIFEST));
  if (installed.name !== name || original.name !== name || installed.version !== spec.slice(prefix.length)) {
    throw new Error('Installed package identity does not match the reviewed alias');
  }
  verifyEntries(source, name, installed);
  return {name, source, target, version: installed.version};
}

// Validate every input before making the first physical replacement.
const replacements = ['picomatch', 'semver', 'send', 'debug', 'fresh', 'nanoid', 'ws'].map(verifiedReplacement);
for (const replacement of replacements) {
  rmSync(replacement.target, {recursive: true});
  cpSync(replacement.source, replacement.target, {recursive: true, dereference: false});
}
return replacements.map(({name, version}) => ({name, version}));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(JSON.stringify({patchedNextVendorPackages: patchNextVendors(process.cwd())}));
}
