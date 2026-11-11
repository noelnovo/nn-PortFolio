// Runs as the real non-root runtime user during the credential-free image build.
const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {createRequire} = require('node:module');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function homepage(server, {attempt = 0, request = fetch, wait = delay} = {}) {
  if (server.exitCode !== null) throw new Error('Standalone server exited early');
  if (attempt >= 60) throw new Error('Standalone server did not become ready');
  try {
    const response = await request('http://127.0.0.1:3123/', {redirect: 'error', signal: AbortSignal.timeout(1000)});
    if (response.status === 200) return response.text();
  } catch { /* Retry only the bounded local startup probe. */ }
  await wait(250);
  return homepage(server, {attempt: attempt + 1, request, wait});
}

async function stop(server, killAfter = 3000) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, 'exit');
  const timeout = setTimeout(() => server.kill('SIGKILL'), killAfter);
  server.kill('SIGTERM');
  await exited;
  clearTimeout(timeout);
}

async function verifyRuntime(load, exists, stage = () => {}) {
  stage('package-manifests');
  for (const binary of ['npm', 'npx', 'corepack', 'yarn', 'yarnpkg']) {
    assert.equal(exists(`/usr/local/bin/${binary}`), false);
  }
  const application = load('./package.json');
  for (const name of ['picomatch', 'semver', 'send', 'debug', 'fresh', 'nanoid', 'ws']) {
    const expected = application.dependencies[`next-patched-${name}`].split('@').at(-1);
    assert.equal(load(`next/dist/compiled/${name}/package.json`).version, expected);
  }
  stage('prior-vendor-apis');
  assert.equal(load('next/dist/compiled/picomatch')('*.js')('test.js'), true);
  assert.equal(load('next/dist/compiled/semver').satisfies(process.versions.node, '>=20.9.0'), true);
  assert.equal(typeof load('next/dist/compiled/send'), 'function');
  const debug = load('next/dist/compiled/debug')('portfolio:smoke');
  assert.equal(typeof debug, 'function');
  assert.equal(debug.namespace, 'portfolio:smoke');
  assert.equal(load('next/dist/compiled/fresh')({'if-none-match': '"fixture"'}, {etag: '"fixture"'}), true);
  stage('nanoid-main');
  const {nanoid, customAlphabet} = load('next/dist/compiled/nanoid');
  stage('nanoid-index');
  assert.equal(typeof load('next/dist/compiled/nanoid/index.cjs').nanoid, 'function');
  stage('nanoid-api');
  assert.match(nanoid(), /^[\w-]{21}$/);
  assert.match(customAlphabet('abc', 12)(), /^[abc]{12}$/);
  assert.equal(customAlphabet('abc', 0)(), '');
  stage('nanoid-nonsecure');
  const nonSecure = load('next/dist/compiled/nanoid/non-secure');
  assert.equal(nonSecure.nanoid(-1), '');
  assert.equal(nonSecure.customAlphabet('abc', -1)(), '');
  stage('ws');
  const WebSocket = load('next/dist/compiled/ws');
  assert.equal(typeof WebSocket, 'function');
  assert.equal(WebSocket.WebSocket, WebSocket);
  assert.equal(WebSocket.Server, WebSocket.WebSocketServer);
  assert.equal(typeof WebSocket.Server, 'function');
  assert.equal(typeof WebSocket.Server.prototype.address, 'function');
  assert.equal(WebSocket.OPEN, 1);
  stage('sharp');
  const png = await load('sharp')({create: {width: 1, height: 1, channels: 3, background: '#000000'}}).png().toBuffer();
  assert.ok(png.length > 0);
}

async function main({load = createRequire(`${process.cwd()}/package.json`), exists = existsSync,
  start = spawn, readPage = homepage, shutdown = stop, log = console.log, errorLog = console.error} = {}) {
  // Only trusted, hardcoded stage IDs enter this private diagnostic state.
  let stage = 'package-manifests';
  try {
    await verifyRuntime(load, exists, value => { stage = value; });
    stage = 'server-start';
    const server = start(process.execPath, ['server.js'], {cwd: process.cwd(),
      env: {NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: '3123'}, stdio: 'ignore'});
    try {
      stage = 'homepage';
      const html = await readPage(server);
      for (const text of ['HL7', 'ASTM', 'POCT1-A']) assert.ok(html.includes(text));
      log(JSON.stringify({standaloneRuntimeSmokePassed: true, homepageStatus: 200, nativeSharpPassed: true}));
    } finally {
      await shutdown(server);
    }
  } catch (error) {
    const code = error?.code;
    const errorCategory = ['ERR_ASSERTION', 'MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(code) ? code : 'other';
    errorLog(JSON.stringify({standaloneRuntimeSmokePassed: false, stage, errorCategory}));
    throw error;
  }
}

module.exports = {homepage, stop, verifyRuntime, main};
if (require.main === module) {
  main().catch(() => {
    process.exitCode = 1;
  });
}
