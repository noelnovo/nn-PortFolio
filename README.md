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
package/symlink identity. The final-image smoke additionally exercises the
standalone HTTP server, native Sharp and the patched dependency APIs as the
non-root runtime user; fixture unit tests do not replace that image smoke.

