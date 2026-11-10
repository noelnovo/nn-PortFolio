# Verified official Node 22 Alpine OCI index; digest-only keeps the pin unambiguous.
FROM node@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY ci/patch-next-vendors.mjs ./ci/patch-next-vendors.mjs
RUN npm ci && node ci/patch-next-vendors.mjs

FROM deps AS security-tests
RUN apk add --no-cache python3 py3-coverage
COPY ci ./ci
COPY src ./src
COPY tests ./tests
COPY vitest.config.mts tsconfig.json ./
COPY .coveragerc ./
RUN npm run test:build-tools && npm test \
    && cat coverage/app/lcov.info >> coverage/lcov.info \
    && python3 -m coverage run -m unittest discover -s ci -p 'test_*.py' \
    && python3 -m coverage xml

FROM scratch AS security-coverage
COPY --from=security-tests /app/coverage/lcov.info /lcov.info
COPY --from=security-tests /app/coverage/python.xml /python.xml

FROM security-tests AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Standalone production server needs Node, not npm/Corepack/Yarn and their
# vulnerable dependency trees. Remove them physically, not from scanner output.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/ci/runtime-smoke.cjs /tmp/portfolio-runtime-smoke.cjs
USER nextjs
RUN node /tmp/portfolio-runtime-smoke.cjs && rm /tmp/portfolio-runtime-smoke.cjs
EXPOSE 3000
CMD ["node", "server.js"]
