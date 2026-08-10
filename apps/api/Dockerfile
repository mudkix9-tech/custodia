# Runtime image for `custodia-api` (WORKER_ROLE=web).
#
# No Chromium. Every PDF the API used to render in-process now renders on the
# Next.js app via lib/pdfClient.ts, so this service is a plain Node process
# again. puppeteer is still imported transitively — routers pull worker modules
# in for their queue handles — but importing it neither launches a browser nor
# needs the binary, and createWorker() is a no-op under WORKER_ROLE=web.
#
# The worker image is Dockerfile.workers; it still needs a browser for consent
# and vendor scanning.
FROM node:20-bookworm-slim

WORKDIR /app

# The whole tree, because there is no build step: start is `tsx src/index.ts`
# and the `db` package resolves to its index.ts source rather than a dist/.
COPY . .

# --ignore-scripts skips the root postinstall (`puppeteer browsers install
# chrome`), a ~150MB download this image has no use for. node-pty is the only
# other package with a build script and apps/api never imports it.
# NODE_ENV is set afterwards so this install keeps devDependencies.
RUN npm ci --ignore-scripts

ENV NODE_ENV=production \
    WORKER_ROLE=web \
    PORT=8080 \
    HOST=0.0.0.0

EXPOSE 8080

CMD ["npm", "run", "start", "--workspace=apps/api"]
