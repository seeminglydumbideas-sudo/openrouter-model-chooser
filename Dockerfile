# Small Node server: serves the pre-built SPA from dist/ and the OpenCode
# Config tab's "Write on disk" endpoint. No npm dependencies — Node 24 runs
# server/*.ts directly. Mount a project's .opencode/ on /app/.opencode to
# receive opencode.jsonc and plugins/image-generation.js (see `make run`).
FROM docker.io/library/node:24-alpine

WORKDIR /app
COPY dist ./dist
COPY server ./server
RUN mkdir -p .opencode

ENV PORT=8080
EXPOSE 8080

# Overridden by `make run` so written files belong to the host user.
USER node

CMD ["node", "server/server.ts"]
