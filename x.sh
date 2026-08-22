You reached the start of the range
2026-08-21 22:17
unpacking archive
29.7 MB
185ms
uploading snapshot
9.6 MB
146ms

internal
load build definition from chatia-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
156ms

internal
load .dockerignore
0ms

internal
load build context
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
12ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs cached
0ms

runner
WORKDIR /app cached
0ms

runner
RUN apk add --no-cache dumb-init cached
0ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json cached
0ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json cached
0ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json cached
0ms

deps
COPY pnpm-workspace.yaml package.json .npmrc ./ cached
0ms

base
WORKDIR /app cached
0ms

base
RUN npm install -g pnpm@10 cached
0ms

deps
COPY chatia-backend/package.json       ./chatia-backend/package.json cached
0ms

deps
RUN pnpm install --frozen-lockfile
1s
Scope: all 5 workspace projects
   ╭──────────────────────────────────────────╮
   │                                          │
   │   Update available! 10.34.5 → 11.22.0.   │
   │   Changelog: https://pnpm.io/v/11.22.0   │
   │     To update, run: pnpm add -g pnpm     │
   │                                          │
   ╰──────────────────────────────────────────╯
 ERR_PNPM_NO_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
Note that in CI environments this setting is true by default. If you still need to run install in such cases, use "pnpm install --no-frozen-lockfile"
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm install --frozen-lockfile" did not complete successfully: exit code: 1 >
scheduling build on Metal builder "builder-nnkfrl"