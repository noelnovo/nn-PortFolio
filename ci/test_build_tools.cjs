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
const versions = {picomatch: '4.0.7', semver: '7.8.6', send: '0.19.2', debug: '4.4.3', fresh: '0.5.2', nanoid: '3.3.18', ws: '8.21.0'};
const patcherPath = path.join(__dirname, 'patch-next-vendors.mjs');
const patcher = () => import(pathToFileURL(patcherPath).href);
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const entryFiles = {
  picomatch: ['index.js'], semver: ['index.js'], send: ['index.js'],
  debug: ['src/index.js', 'src/node.js', 'src/common.js'], fresh: ['index.js'],
  nanoid: ['index.cjs', 'non-secure/index.cjs', 'url-alphabet/index.cjs'],
  ws: ['index.js', 'lib/websocket.js', 'lib/websocket-server.js'],
};

function assertTargetsUntouched(root) {
  for (const name of Object.keys(versions)) {
    const target = path.join(root, 'node_modules/next/dist/compiled', name);
    assert.deepEqual(fs.readdirSync(target).sort(), ['index.js', 'package.json']);
    assert.equal(fs.readFileSync(path.join(target, 'index.js'), 'utf8'), `original-${name}`);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'package.json'))), {name});
  }
}

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
    const metadata = {name, version};
    if (!['send', 'fresh'].includes(name)) metadata.main = entryFiles[name][0];
    if (name === 'nanoid') metadata.exports = {'.': {require: {default: './index.cjs'}},
      './non-secure': {require: {default: './non-secure/index.cjs'}}};
    if (name === 'ws') metadata.exports = {'.': {require: './index.js'}, './lib/*': ['./lib/*.js', null]};
    writeJson(path.join(source, 'package.json'), metadata);
    writeJson(path.join(target, 'package.json'), {name});
    fs.writeFileSync(path.join(source, 'index.js'), `patched-${name}`);
    for (const file of entryFiles[name]) {
      fs.mkdirSync(path.dirname(path.join(source, file)), {recursive: true});
      fs.writeFileSync(path.join(source, file), `patched-${name}`);
    }
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
  for (const name of Object.keys(versions)) {
  for (const change of ['source-name', 'target-name', 'version']) {
    const root = fixture();
    const file = change === 'target-name' ? path.join(root, `node_modules/next/dist/compiled/${name}/package.json`)
      : path.join(root, `node_modules/next-patched-${name}/package.json`);
    const data = JSON.parse(fs.readFileSync(file));
    if (change === 'version') data.version = '0.0.0';
    else data.name = 'other';
    writeJson(file, data);
    assert.throws(() => patchNextVendors(root), /identity/);
    assert.equal(fs.readFileSync(path.join(root, 'node_modules/next/dist/compiled/picomatch/index.js'), 'utf8'), 'original-picomatch');
  }
  }
});

test('missing new vendor inputs fail before any replacement', async () => {
  const {patchNextVendors} = await patcher();
  for (const name of ['nanoid', 'ws']) {
    for (const relative of [`node_modules/next-patched-${name}`, `node_modules/next/dist/compiled/${name}`]) {
      const root = fixture();
      fs.rmSync(path.join(root, relative), {recursive: true});
      assert.throws(() => patchNextVendors(root), /ENOENT/);
      assert.equal(fs.readFileSync(path.join(root, 'node_modules/next/dist/compiled/picomatch/index.js'), 'utf8'), 'original-picomatch');
    }
  }
});

test('symlinked root, package destination or source cannot escape the tree', async () => {
  const {patchNextVendors} = await patcher();
  for (const target of ['node_modules/next/dist/compiled', ...Object.keys(versions).flatMap(name =>
    [`node_modules/next/dist/compiled/${name}`, `node_modules/next-patched-${name}`])]) {
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

test('nested source file and directory symlinks fail before any replacement, even in the seventh package', async () => {
  const {patchNextVendors} = await patcher();
  for (const kind of ['file', 'directory', 'dangling', 'internal']) {
    const root = fixture();
    const outside = path.join(root, 'retained');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'marker'), 'keep');
    const source = path.join(root, 'node_modules/next-patched-ws');
    const destination = kind === 'directory' ? outside : kind === 'internal' ? path.join(source, 'index.js')
      : path.join(outside, kind === 'dangling' ? 'missing' : 'marker');
    fs.symlinkSync(destination, path.join(source, 'lib/unsafe'), kind === 'directory' ? 'dir' : 'file');
    assert.throws(() => patchNextVendors(root), /regular|physical|symlink/);
    assertTargetsUntouched(root);
    assert.equal(fs.readFileSync(path.join(outside, 'marker'), 'utf8'), 'keep');
  }
});

test('unexpected source file types and non-directory package roots fail before mutation', async () => {
  const {patchNextVendors} = await patcher();
  for (const kind of ['fifo', 'source-file', 'target-file']) {
    const root = fixture();
    if (kind === 'fifo') {
      assert.equal(spawnSync('mkfifo', [path.join(root, 'node_modules/next-patched-ws/lib/pipe')]).status, 0);
    } else {
      const file = path.join(root, kind === 'source-file' ? 'node_modules/next-patched-ws' : 'node_modules/next/dist/compiled/ws');
      fs.rmSync(file, {recursive: true});
      fs.writeFileSync(file, 'not a directory');
    }
    assert.throws(() => patchNextVendors(root), /regular|physical/);
    if (kind !== 'target-file') assertTargetsUntouched(root);
    else assert.equal(fs.readFileSync(path.join(root, 'node_modules/next/dist/compiled/ws'), 'utf8'), 'not a directory');
  }
});

test('destination manifest symlinks or directories are rejected without reading or changing targets', async () => {
  const {patchNextVendors} = await patcher();
  for (const kind of ['symlink', 'directory']) {
    const root = fixture();
    const target = path.join(root, 'node_modules/next/dist/compiled/ws');
    const file = path.join(target, 'package.json');
    const outside = path.join(root, 'retained');
    fs.writeFileSync(outside, 'not JSON: must never be read as a manifest');
    fs.rmSync(file);
    if (kind === 'directory') fs.mkdirSync(file);
    else fs.symlinkSync(outside, file);
    assert.throws(() => patchNextVendors(root), /manifest must be a regular file/);
    for (const name of Object.keys(versions)) {
      assert.equal(fs.readFileSync(path.join(root, `node_modules/next/dist/compiled/${name}/index.js`), 'utf8'), `original-${name}`);
      if (name !== 'ws') assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, `node_modules/next/dist/compiled/${name}/package.json`))), {name});
    }
    assert.equal(fs.lstatSync(file).isSymbolicLink(), kind === 'symlink');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'not JSON: must never be read as a manifest');
  }
});

test('declared main and export paths cannot escape or redirect reviewed entries', async () => {
  const {patchNextVendors} = await patcher();
  for (const change of ['main-parent', 'main-parent-directory', 'main-absolute', 'main-empty', 'main-number', 'main-redirect',
    'export-parent', 'export-absolute', 'export-number', 'export-redirect', 'export-missing']) {
    const root = fixture();
    const file = path.join(root, 'node_modules/next-patched-ws/package.json');
    const data = JSON.parse(fs.readFileSync(file));
    if (change.startsWith('main-')) data.main = {
      'main-parent': '../retained.js', 'main-absolute': '/outside.js', 'main-empty': '',
      'main-number': 42, 'main-redirect': 'lib/websocket.js', 'main-parent-directory': '..',
    }[change];
    else if (change === 'export-missing') delete data.exports;
    else if (change === 'export-redirect') data.exports['.'].require = './lib/websocket.js';
    else if (change === 'export-number') data.exports['./unused'] = 42;
    else data.exports['./unused'] = {import: change === 'export-parent' ? '../outside.js' : '/outside.js'};
    writeJson(file, data);
    assert.throws(() => patchNextVendors(root), /entry|export/);
    assertTargetsUntouched(root);
  }
});

test('all seven packages require nonempty regular entry files before any replacement', async () => {
  const {patchNextVendors} = await patcher();
  for (const [name, files] of Object.entries(entryFiles)) {
    for (const entry of files) {
      for (const change of ['missing', 'empty', 'directory']) {
        const root = fixture();
        const file = path.join(root, `node_modules/next-patched-${name}`, entry);
        fs.rmSync(file);
        if (change === 'empty') fs.writeFileSync(file, '  \n');
        if (change === 'directory') fs.mkdirSync(file);
        assert.throws(() => patchNextVendors(root), /ENOENT|entry/);
        assertTargetsUntouched(root);
      }
    }
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
  function WebSocket() {}
  WebSocket.WebSocket = WebSocket;
  WebSocket.Server = WebSocket.WebSocketServer = function WebSocketServer() {};
  WebSocket.Server.prototype.address = () => null;
  WebSocket.OPEN = 1;
  const entries = {
    './package.json': {dependencies: Object.fromEntries(Object.entries(versions).map(([name, version]) => [`next-patched-${name}`, `npm:${name}@${version}`]))},
    ...Object.fromEntries(Object.entries(versions).map(([name, version]) => [`next/dist/compiled/${name}/package.json`, {version}])),
    'next/dist/compiled/picomatch': () => () => true,
    'next/dist/compiled/semver': {satisfies: () => true},
    'next/dist/compiled/send': () => {},
    'next/dist/compiled/debug': namespace => Object.assign(() => {}, {namespace}),
    'next/dist/compiled/fresh': () => true,
    'next/dist/compiled/nanoid': {nanoid: () => 'a'.repeat(21), customAlphabet: (alphabet, size) => () => size === 0 ? '' : 'abc'.repeat(4)},
    'next/dist/compiled/nanoid/index.cjs': {nanoid: () => 'a'.repeat(21)},
    'next/dist/compiled/nanoid/non-secure': {nanoid: () => '', customAlphabet: () => () => ''},
    'next/dist/compiled/ws': WebSocket,
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
  await assert.rejects(smoke.verifyRuntime(applicationLoad({'next/dist/compiled/nanoid': {nanoid: () => 'invalid'}}), () => false));
  await assert.rejects(smoke.verifyRuntime(applicationLoad({'next/dist/compiled/ws': {}}), () => false));
  await assert.rejects(smoke.verifyRuntime(applicationLoad({sharp: () => ({png: () => ({toBuffer: async () => Buffer.alloc(0)})})}), () => false));
});

for (const mode of ['success', 'missing-marker', 'request-error']) {
  test(`main validates homepage and always cleans up: ${mode}`, async () => {
    let cleaned = false;
    const logged = [];
    const errors = [];
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
      shutdown: async () => { cleaned = true; }, log: value => logged.push(JSON.parse(value)),
      errorLog: value => errors.push(JSON.parse(value))});
    if (mode === 'success') { await run; assert.equal(logged[0].homepageStatus, 200); }
    else {
      await assert.rejects(run);
      assert.equal(logged.length, 0);
      assert.deepEqual(errors, [{standaloneRuntimeSmokePassed: false, stage: 'homepage',
        errorCategory: mode === 'missing-marker' ? 'ERR_ASSERTION' : 'other'}]);
    }
    assert.equal(cleaned, true);
  });
}

test('runtime CLI fails closed without a production installation', () => {
  const root = fixture();
  const result = spawnSync(process.execPath, [path.join(__dirname, 'runtime-smoke.cjs')], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stderr), {standaloneRuntimeSmokePassed: false,
    stage: 'package-manifests', errorCategory: 'ERR_ASSERTION'});
});

test('failure diagnostics use fixed stages/categories, disclose no error payload and preserve cleanup/rejection', async () => {
  const stages = {
    'package-manifests': './package.json',
    'prior-vendor-apis': 'next/dist/compiled/picomatch',
    'nanoid-main': 'next/dist/compiled/nanoid',
    'nanoid-index': 'next/dist/compiled/nanoid/index.cjs',
    'nanoid-api': 'nanoid-call',
    'nanoid-nonsecure': 'next/dist/compiled/nanoid/non-secure',
    ws: 'next/dist/compiled/ws', sharp: 'sharp',
    'server-start': 'start', homepage: 'read-page',
  };
  const sentinel = 'SYNTHETIC_ERROR_PAYLOAD_MUST_NOT_BE_LOGGED';
  for (const [stage, target] of Object.entries(stages)) {
    for (const code of ['ERR_ASSERTION', 'MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED', sentinel,
      undefined, {toJSON: () => { throw new Error('Untrusted code must not be serialized'); }}]) {
      const failure = Object.assign(new Error(sentinel), {stack: sentinel, cause: {message: sentinel}, code});
      const messages = [];
      let cleaned = false;
      const load = applicationLoad(target === 'nanoid-call'
        ? {'next/dist/compiled/nanoid': {nanoid: () => { throw failure; }, customAlphabet: () => {}}} : {});
      const run = smoke.main({load: name => { if (name === target) throw failure; return load(name); }, exists: () => false,
        start: () => { if (target === 'start') throw failure; return child(); },
        readPage: async () => { throw failure; }, shutdown: async () => { cleaned = true; },
        log: () => assert.fail('Failed smoke cannot report success'), errorLog: value => messages.push(value)});
      await assert.rejects(run, error => error === failure);
      assert.equal(cleaned, stage === 'homepage');
      assert.equal(messages.length, 1);
      assert.equal(messages[0].includes(sentinel), false);
      assert.deepEqual(JSON.parse(messages[0]), {standaloneRuntimeSmokePassed: false, stage,
        errorCategory: ['ERR_ASSERTION', 'MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(code) ? code : 'other'});
    }
  }
});

test('CLI emits only one sanitized JSON diagnostic and exits nonzero for untrusted error data', () => {
  const root = fixture();
  const sentinel = 'SYNTHETIC_CLI_ERROR_PAYLOAD_MUST_NOT_BE_LOGGED';
  const preload = path.join(root, 'preload.cjs');
  fs.writeFileSync(preload, `const Module = require('node:module');
    const original = Module._load;
    Module._load = function(request, ...args) {
      if (request === './package.json') {
        const error = new Error('${sentinel}');
        error.stack = '${sentinel}'; error.cause = '${sentinel}'; error.code = '${sentinel}'; throw error;
      }
      return original.call(this, request, ...args);
    };`);
  const result = spawnSync(process.execPath, ['--require', preload, path.join(__dirname, 'runtime-smoke.cjs')], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.includes(sentinel), false);
  assert.equal(result.stderr.trim().split('\n').length, 1);
  assert.deepEqual(JSON.parse(result.stderr), {standaloneRuntimeSmokePassed: false,
    stage: 'package-manifests', errorCategory: 'other'});
});
