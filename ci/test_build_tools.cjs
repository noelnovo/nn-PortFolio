const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawnSync} = require('node:child_process');
const {EventEmitter} = require('node:events');
const smoke = require('./runtime-smoke.cjs');

const roots = [];
const versions = {picomatch: '4.0.7', semver: '7.8.6', send: '0.19.2', debug: '4.4.3', fresh: '0.5.2'};
const patcherPath = path.join(__dirname, 'patch-next-vendors.mjs');
const patcher = () => import(pathToFileURL(patcherPath).href);
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-vendor-test-'));
  roots.push(root);
  writeJson(path.join(root, 'package.json'), {dependencies: {next: '16.4.6',
    ...Object.fromEntries(Object.entries(versions).map(([name, version]) => [`next-patched-${name}`, `npm:${name}@${version}`]))}});
  const nextRoot = path.join(root, 'node_modules', 'next');
  fs.mkdirSync(nextRoot, {recursive: true});
  writeJson(path.join(nextRoot, 'package.json'), {name: 'next', version: '16.4.6'});
  for (const [name, version] of Object.entries(versions)) {
    const source = path.join(root, 'node_modules', `next-patched-${name}`);
    const target = path.join(nextRoot, 'dist', 'compiled', name);
    fs.mkdirSync(source, {recursive: true});
    fs.mkdirSync(target, {recursive: true});
    writeJson(path.join(source, 'package.json'), {name, version});
    writeJson(path.join(target, 'package.json'), {name});
    fs.writeFileSync(path.join(source, 'index.js'), `patched-${name}`);
    fs.writeFileSync(path.join(target, 'index.js'), `original-${name}`);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, {recursive: true, force: true});
});

test('vendor replacement copies actual code and exact metadata', async () => {
  const root = fixture();
  const result = (await patcher()).patchNextVendors(root);
  assert.equal(result.length, Object.keys(versions).length);
  for (const [name, version] of Object.entries(versions)) {
    const target = path.join(root, 'node_modules/next/dist/compiled', name);
    assert.equal(fs.readFileSync(path.join(target, 'index.js'), 'utf8'), `patched-${name}`);
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).version, version);
  }
});

test('patcher CLI executes the same reviewed replacement', () => {
  const root = fixture();
  const result = spawnSync(process.execPath, [patcherPath], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).patchedNextVendorPackages.length, Object.keys(versions).length);
});

test('unsupported Next release or mismatched root pin fails before mutation', async () => {
  const {patchNextVendors} = await patcher();
  for (const target of ['next', 'application']) {
    const root = fixture();
    const file = target === 'next' ? path.join(root, 'node_modules/next/package.json') : path.join(root, 'package.json');
    const data = JSON.parse(fs.readFileSync(file));
    if (target === 'next') data.version = '16.3.1';
    else data.dependencies.next = '16.3.1';
    writeJson(file, data);
    assert.throws(() => patchNextVendors(root), /pinned Next/);
  }
});

test('inexact, missing or wrong-package aliases are rejected', async () => {
  const {patchNextVendors} = await patcher();
  for (const spec of [undefined, 'npm:other@4.0.7', 'npm:picomatch@^4.0.7']) {
    const root = fixture();
    const file = path.join(root, 'package.json');
    const data = JSON.parse(fs.readFileSync(file));
    data.dependencies['next-patched-picomatch'] = spec;
    writeJson(file, data);
    assert.throws(() => patchNextVendors(root), /exact patched/);
  }
});

test('every package identity is validated before any file is replaced', async () => {
  const {patchNextVendors} = await patcher();
  for (const change of ['source-name', 'target-name', 'version']) {
    const root = fixture();
    const file = change === 'target-name' ? path.join(root, 'node_modules/next/dist/compiled/semver/package.json')
      : path.join(root, 'node_modules/next-patched-semver/package.json');
    const data = JSON.parse(fs.readFileSync(file));
    if (change === 'version') data.version = '0.0.0';
    else data.name = 'other';
    writeJson(file, data);
    assert.throws(() => patchNextVendors(root), /identity/);
    assert.equal(fs.readFileSync(path.join(root, 'node_modules/next/dist/compiled/picomatch/index.js'), 'utf8'), 'original-picomatch');
  }
});

test('symlinked root, package destination or source cannot escape the tree', async () => {
  const {patchNextVendors} = await patcher();
  for (const target of ['node_modules/next/dist/compiled', 'node_modules/next/dist/compiled/send', 'node_modules/next-patched-send']) {
    const root = fixture();
    const outside = path.join(root, 'retained');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'marker'), 'keep');
    fs.rmSync(path.join(root, target), {recursive: true});
    fs.symlinkSync(outside, path.join(root, target), 'dir');
    assert.throws(() => patchNextVendors(root), /symlink|physical/);
    assert.equal(fs.readFileSync(path.join(outside, 'marker'), 'utf8'), 'keep');
  }
});

test('homepage startup probe succeeds, retries bad responses/errors and stays bounded', async () => {
  let calls = 0;
  const request = async () => {
    calls += 1;
    if (calls === 1) return {status: 503};
    if (calls === 2) throw new Error('not ready');
    return {status: 200, text: async () => 'page'};
  };
  assert.equal(await smoke.homepage({exitCode: null}, {request}), 'page');
  assert.equal(calls, 3);
  await assert.rejects(smoke.homepage({exitCode: 1}), /exited early/);
  await assert.rejects(smoke.homepage({exitCode: null}, {attempt: 60}), /did not become ready/);
});

function child(force = false) {
  const server = new EventEmitter();
  server.exitCode = null;
  server.signalCode = null;
  server.signals = [];
  server.kill = signal => {
    server.signals.push(signal);
    if (!force || signal === 'SIGKILL') queueMicrotask(() => { server.signalCode = signal; server.emit('exit', null, signal); });
  };
  return server;
}

test('server cleanup handles already-exited, graceful and forced exits', async () => {
  await smoke.stop({exitCode: 0, signalCode: null});
  await smoke.stop({exitCode: null, signalCode: 'SIGTERM'});
  const graceful = child();
  await smoke.stop(graceful);
  assert.deepEqual(graceful.signals, ['SIGTERM']);
  const forced = child(true);
  await smoke.stop(forced, 1);
  assert.deepEqual(forced.signals, ['SIGTERM', 'SIGKILL']);
});

function applicationLoad(overrides = {}) {
  const entries = {
    './package.json': {dependencies: Object.fromEntries(Object.entries(versions).map(([name, version]) => [`next-patched-${name}`, `npm:${name}@${version}`]))},
    ...Object.fromEntries(Object.entries(versions).map(([name, version]) => [`next/dist/compiled/${name}/package.json`, {version}])),
    'next/dist/compiled/picomatch': () => () => true,
    'next/dist/compiled/semver': {satisfies: () => true},
    'next/dist/compiled/send': () => {},
    'next/dist/compiled/debug': namespace => Object.assign(() => {}, {namespace}),
    'next/dist/compiled/fresh': () => true,
    sharp: () => ({png: () => ({toBuffer: async () => Buffer.from('png')})}),
    ...overrides,
  };
  return name => {
    assert.ok(Object.hasOwn(entries, name));
    return entries[name];
  };
}

test('runtime validation exercises versions, APIs, native image operation and installer absence', async () => {
  await smoke.verifyRuntime(applicationLoad(), () => false);
  await assert.rejects(smoke.verifyRuntime(applicationLoad(), () => true));
  await assert.rejects(smoke.verifyRuntime(applicationLoad({'next/dist/compiled/send/package.json': {version: '0.0.0'}}), () => false));
  await assert.rejects(smoke.verifyRuntime(applicationLoad({'next/dist/compiled/picomatch': () => () => false}), () => false));
  await assert.rejects(smoke.verifyRuntime(applicationLoad({sharp: () => ({png: () => ({toBuffer: async () => Buffer.alloc(0)})})}), () => false));
});

for (const mode of ['success', 'missing-marker', 'request-error']) {
  test(`main validates homepage and always cleans up: ${mode}`, async () => {
    let cleaned = false;
    const logged = [];
    const run = smoke.main({load: applicationLoad(), exists: () => false,
      start: (executable, args, options) => {
        assert.equal(executable, process.execPath);
        assert.deepEqual(args, ['server.js']);
        assert.deepEqual(Object.keys(options.env).sort(), ['HOSTNAME', 'NEXT_TELEMETRY_DISABLED', 'NODE_ENV', 'PORT']);
        return child();
      },
      readPage: async () => {
        if (mode === 'request-error') throw new Error('probe failed');
        return mode === 'success' ? 'HL7 ASTM POCT1-A' : 'missing markers';
      },
      shutdown: async () => { cleaned = true; }, log: value => logged.push(JSON.parse(value))});
    if (mode === 'success') { await run; assert.equal(logged[0].homepageStatus, 200); }
    else { await assert.rejects(run); assert.equal(logged.length, 0); }
    assert.equal(cleaned, true);
  });
}

test('runtime CLI fails closed without a production installation', () => {
  const root = fixture();
  const result = spawnSync(process.execPath, [path.join(__dirname, 'runtime-smoke.cjs')], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /runtime smoke failed/);
});
