// Runs as the real non-root runtime user during the credential-free image build.
const assert = require('node:assert/strict');
const {existsSync} = require('node:fs');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const requireApplication = require('node:module').createRequire(`${process.cwd()}/package.json`);

async function homepage(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Standalone server exited early');
    try {
      const response = await fetch('http://127.0.0.1:3123/', {redirect: 'error', signal: AbortSignal.timeout(1000)});
      if (response.status === 200) return response.text();
    } catch { /* Retry only the bounded local startup probe. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Standalone server did not become ready');
}

async function stop(server) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, 'exit');
  const timeout = setTimeout(() => server.kill('SIGKILL'), 3000);
  server.kill('SIGTERM');
  await exited;
  clearTimeout(timeout);
}

async function main() {
  for (const binary of ['npm', 'npx', 'corepack', 'yarn', 'yarnpkg']) {
    assert.equal(existsSync(`/usr/local/bin/${binary}`), false);
  }
  const application = require(`${process.cwd()}/package.json`);
  for (const name of ['picomatch', 'semver', 'send']) {
    const expected = application.dependencies[`next-patched-${name}`].split('@').at(-1);
    assert.equal(requireApplication(`next/dist/compiled/${name}/package.json`).version, expected);
  }
  assert.equal(requireApplication('next/dist/compiled/picomatch')('*.js')('test.js'), true);
  assert.equal(requireApplication('next/dist/compiled/semver').satisfies(process.versions.node, '>=20.9.0'), true);
  assert.equal(typeof requireApplication('next/dist/compiled/send'), 'function');
  const png = await requireApplication('sharp')({create: {width: 1, height: 1, channels: 3, background: '#000000'}}).png().toBuffer();
  assert.ok(png.length > 0);
  const server = spawn(process.execPath, ['server.js'], {cwd: process.cwd(),
    env: {NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: '3123'}, stdio: 'ignore'});
  try {
    const html = await homepage(server);
    for (const text of ['HL7', 'ASTM', 'POCT1-A']) assert.ok(html.includes(text));
    console.log(JSON.stringify({standaloneRuntimeSmokePassed: true, homepageStatus: 200, nativeSharpPassed: true}));
  } finally {
    await stop(server);
  }
}

main().catch(() => {
  console.error('Standalone runtime smoke failed; details withheld');
  process.exitCode = 1;
});
