# Runtime image for the whole backend in one service: Fastify and the
# background workers in a single process.
#
# The split is controlled entirely by WORKER_ROLE. Unset (as here), index.ts
# registers every worker via the workers/index.js barrel and calls
# scheduleGlobalJobs() after listen(); set to `web`, createWorker() becomes a
# no-op and this serves HTTP only. Setting it in the platform is all that is
# needed to split the API and workers apart again later.
#
# Chromium is present because three of the twenty-eight workers drive a real
# page — consentScan, vendors and cmp. It comes from apt rather than
# Puppeteer's own download so the package pulls its runtime libraries with it,
# and so this image builds on arm64 where Chrome-for-Testing has no release.
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The whole tree, because there is no build step: start is `tsx src/index.ts`
# and the `db` package resolves to its index.ts source rather than a dist/.
COPY . .

# `npm install`, not `npm ci`: ci adds a strict lockfile/manifest agreement check
# that the lockfile (written by npm 11) does not survive under the npm 10 in
# node:20. Resolution still comes from package-lock.json either way.
# --ignore-scripts skips the root postinstall (`puppeteer browsers install
# chrome`), which would fetch a second browser on top of the apt one.
# NODE_ENV is set afterwards so this install keeps devDependencies.
RUN npm install --ignore-scripts --no-audit --no-fund

# puppeteer.executablePath() reads this, which is what browserPool.ts calls.
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=8080 \
    HOST=0.0.0.0

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace=apps/api"]
