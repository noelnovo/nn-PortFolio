# Web portfolio
## Purpose
I'm doing this small React js + Tailwind project because I want to learn these kind of technologies since I'm mostly specialized in backend.
I dont mean to "flex" my humble frontend skills because of the simple fact that its not my vibe. I just think that a software developer without a web portfolio is like a taxi without a drivers license.
## Technologies involved
- React
- TypeScript
- NextJS

## Credential-free verification

Use Node 22.12 or newer in the Node 22 family (the Dockerfile pins the build and
runtime image). No real mail, Vault or scanner credentials are needed:

```sh
npm ci
npm run test:build-tools
npm test
npm run compile
```

The build-tool suite tests real replacement/cleanup logic using isolated fixtures.
The application suite covers rendered sections/icons, hooks, contact-form states
and the contact API with synthetic transport responses. It measures all production
TypeScript/TSX under `src`, including initially uncovered files. The existing
build-tool LCOV report and application LCOV report are combined only after both
suites pass; line, branch and function thresholds must not be bypassed.

For Python delivery/probe helpers, use a repo-local environment with `coverage`:

```sh
.venv/bin/python -m coverage run -m unittest discover -s ci -p 'test_*.py'
.venv/bin/python -m coverage xml
```

`security-coverage` exports `/lcov.info` and `/python.xml`. A reviewed immutable
shared-controller release and exact caller/trust-pin migration are required to
consume the expanded source/report allowlist. Do not reuse local reports as CI
candidate evidence. Check disk headroom before installs/builds; syntax checks or
an npm dry-run do not establish application coverage or a successful image build.

Next's bundled libraries and ordinary dependencies are both patched with actual
lockfile-verified code. The patcher refuses a different Next version or unexpected
package/symlink identity. It rejects nested symlinks and special source files,
validates declared entry-path containment and nonempty reviewed runtime entries
for every replacement before deleting or copying any vendor directory.
The final-image smoke additionally exercises the
standalone HTTP server, native Sharp and the patched dependency APIs as the
non-root runtime user; fixture unit tests do not replace that image smoke.

The existing vendor patcher also copies the exact runtime aliases
`nanoid@3.3.18` and `ws@8.21.0` into Next 16.4.6's compiled directories, including
their real source and package metadata. Neither requires additional npm packages;
nanoid uses built-in crypto and ws supports JavaScript operation without its
optional native accelerators. Runtime smoke checks their CommonJS APIs as well
as the installed versions; a full standalone image build remains required.

For standalone packaging, `outputFileTracingIncludes` explicitly includes only
the patched nanoid `non-secure/package.json` and `non-secure/index.cjs` for all
server routes, using Next's documented `/*` route key and project-relative paths.
Those two files form the non-secure CommonJS resolution closure (its entry has
no imports). This preserves the existing runtime smoke rather than removing its
non-secure checks; a fresh final-image build must still verify the result.
See [Next output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

Advisory references: nanoid 3.3.18 fixes
[CVE-2026-67214](https://github.com/advisories/GHSA-28wg-ghj8-5hjv)
(affected 3.x versions `<3.3.16`) and
[CVE-2026-67213](https://github.com/advisories/GHSA-2v37-7h3g-55p8)
(affected 3.x versions `<3.3.18`). ws 8.21.0 fixes
[CVE-2026-45736](https://github.com/advisories/GHSA-58qx-3vcg-4xpx)
(affected `>=8.0.0, <8.20.1`) and
[CVE-2026-48779](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)
(affected 8.x versions `>=8.0.0, <8.21.0`).
Bundled image-size 1.2.1 remains unchanged: it is already patched according to
[GHSA-m5qc-5hw7-8vg7](https://github.com/advisories/GHSA-m5qc-5hw7-8vg7), which
lists the affected 1.x range as `>=1.1.0, <1.2.1`. These are partial fixes, not a claim of
zero vulnerabilities or cleared scanner findings; no suppression is applied.
