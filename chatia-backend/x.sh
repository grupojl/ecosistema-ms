You reached the start of the range
2026-08-21 22:58
unpacking archive
29.7 MB
178ms
uploading snapshot
9.6 MB
320ms

internal
load build definition from chatia-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
477ms

internal
load .dockerignore
0ms

internal
load build context
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
10ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs cached
0ms

runner
WORKDIR /app cached
0ms

runner
RUN apk add --no-cache dumb-init cached
0ms

base
WORKDIR /app cached
10ms

base
RUN npm install -g pnpm@10 cached
0ms

deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
146ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json
86ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json
95ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
100ms

deps
COPY chatia-backend/package.json                 ./chatia-backend/package.json
73ms

deps
RUN pnpm install --frozen-lockfile
5s
Done in 4.7s using pnpm v10.34.5

builder
COPY tsconfig.base.json     ./
455ms

builder
COPY packages/proto/        ./packages/proto/
91ms

builder
COPY packages/auth-server/  ./packages/auth-server/
94ms

builder
COPY packages/grpc-client/  ./packages/grpc-client/
107ms

builder
COPY chatia-backend/                  ./chatia-backend/
128ms

builder
RUN pnpm --filter chatia-backend build
1s
> chatia-backend@0.0.1 build /app/chatia-backend
> prisma generate && nest build
Failed to load config file "/app/chatia-backend" as a TypeScript/JavaScript module. Error: PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.
/app/chatia-backend:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  chatia-backend@0.0.1 build: `prisma generate && nest build`
Exit status 1
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm --filter chatia-backend build" did not complete successfully: exit code: 1 >
scheduling build on Metal builder "builder-nnkfrl"

You reached the start of the range
2026-08-21 22:58
unpacking archive
29.7 MB
162ms
uploading snapshot
9.6 MB
121ms

internal
load build definition from pasarelapagos-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
333ms

internal
load .dockerignore
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
12ms

internal
load build context
1ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs cached
0ms

runner
WORKDIR /app cached
0ms

runner
RUN apk add --no-cache dumb-init cached
0ms

base
RUN npm install -g pnpm@10 cached
0ms

base
WORKDIR /app cached
0ms

deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
216ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json
132ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json
123ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
122ms

deps
COPY pasarelapagos-backend/package.json                 ./pasarelapagos-backend/package.json
112ms

deps
RUN pnpm install --frozen-lockfile
6s
Done in 5s using pnpm v10.34.5
scheduling build on Metal builder "builder-mywggh"

builder
COPY tsconfig.base.json     ./
565ms

builder
COPY packages/proto/        ./packages/proto/
129ms

builder
COPY packages/auth-server/  ./packages/auth-server/
139ms

builder
COPY packages/grpc-client/  ./packages/grpc-client/
130ms

builder
COPY pasarelapagos-backend/                  ./pasarelapagos-backend/
145ms

builder
RUN pnpm --filter pasarelapagos-backend build
2s
> pasarelapagos-backend@0.0.1 build /app/pasarelapagos-backend
> prisma generate && nest build
Failed to load config file "/app/pasarelapagos-backend" as a TypeScript/JavaScript module. Error: PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.
/app/pasarelapagos-backend:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  pasarelapagos-backend@0.0.1 build: `prisma generate && nest build`
Exit status 1
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm --filter pasarelapagos-backend build" did not complete successfully: exit code: 1


You reached the start of the range
2026-08-21 22:58
scheduling build on Metal builder "builder-fumiuy"
unpacking archive
29.7 MB
168ms
uploading snapshot
9.6 MB
129ms

internal
load build definition from notificaciones-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
342ms

internal
load .dockerignore
0ms

internal
load build context
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
9ms

runner
WORKDIR /app cached
0ms

runner
RUN apk add --no-cache dumb-init cached
0ms

base
WORKDIR /app cached
0ms

base
RUN npm install -g pnpm@10 cached
0ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs
267ms

deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
109ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json
64ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json
64ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
72ms

deps
COPY notificaciones-backend/package.json                 ./notificaciones-backend/package.json
67ms

deps
RUN pnpm install --frozen-lockfile
5s
Done in 4.3s using pnpm v10.34.5

builder
COPY tsconfig.base.json     ./
399ms

builder
COPY packages/proto/        ./packages/proto/
73ms

builder
COPY packages/auth-server/  ./packages/auth-server/
70ms

builder
COPY packages/grpc-client/  ./packages/grpc-client/
91ms

builder
COPY notificaciones-backend/                  ./notificaciones-backend/
124ms

builder
RUN pnpm --filter notificaciones-backend build
3s
> notificaciones-backend@0.0.1 build /app/notificaciones-backend
> nest build
src/grpc/notificaciones-grpc.controller.ts:12:38 - error TS2339: Property 'notificationId' does not exist on type '{ jobId: string; channel: string; }'.
12     return { notification_id: result.notificationId, status: result.status, message: "OK" };
                                        ~~~~~~~~~~~~~~
src/grpc/notificaciones-grpc.controller.ts:12:69 - error TS2339: Property 'status' does not exist on type '{ jobId: string; channel: string; }'.
12     return { notification_id: result.notificationId, status: result.status, message: "OK" };
                                                                       ~~~~~~
src/health/health.controller.ts:31:47 - error TS2345: Argument of type 'PrismaService' is not assignable to parameter of type 'PrismaClient'.
31       () => this.prisma.pingCheck('database', this.db),
                                                 ~~~~~~~
src/health/health.controller.ts:40:47 - error TS2345: Argument of type 'PrismaService' is not assignable to parameter of type 'PrismaClient'.
40       () => this.prisma.pingCheck('database', this.db),
                                                 ~~~~~~~
src/notifications/dlq/dlq-monitor.service.ts:39:58 - error TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled.
39     @Inject('CHATIA_GRPC_CLIENT') private readonly grpc: ClientGrpc,
                                                            ~~~~~~~~~~
  src/notifications/dlq/dlq-monitor.service.ts:13:10
    13 import { ClientGrpc }                                from '@nestjs/microservices';
                ~~~~~~~~~~
    'ClientGrpc' was imported here.
src/notifications/notifications.service.ts:65:33 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
65     const n = await this.prisma.notification.findUnique({ where: { id } });
                                   ~~~~~~~~~~~~
src/notifications/notifications.service.ts:88:39 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
88     const grouped = await this.prisma.notification.groupBy({
                                         ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:38:40 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
38     const existing = await this.prisma.notification.findUnique({
                                          ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:47:36 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
47     const pref = await this.prisma.contactPreference.findUnique({
                                      ~~~~~~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:78:25 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
78       await this.prisma.notification.update({
                           ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:85:25 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
85       await this.prisma.notification.update({
                           ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:103:24 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
103     return this.prisma.notification.upsert({
                           ~~~~~~~~~~~~
src/preferences/preferences.service.ts:7:24 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
7     return this.prisma.contactPreference.findMany({ where: { organizationId, contactId } });
                         ~~~~~~~~~~~~~~~~~
src/preferences/preferences.service.ts:10:24 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
10     return this.prisma.contactPreference.upsert({
                          ~~~~~~~~~~~~~~~~~
src/prisma/prisma.service.ts:2:10 - error TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'.
2 import { PrismaClient } from '@prisma/client';
           ~~~~~~~~~~~~
src/prisma/prisma.service.ts:21:16 - error TS2339: Property '$connect' does not exist on type 'PrismaService'.
21     await this.$connect();
                  ~~~~~~~~
src/prisma/prisma.service.ts:26:16 - error TS2339: Property '$disconnect' does not exist on type 'PrismaService'.
26     await this.$disconnect();
                  ~~~~~~~~~~~
../packages/proto/src/index.ts:3:34 - error TS1470: The 'import.meta' meta-property is not allowed in files which will build into CommonJS output.
3 const __filename = fileURLToPath(import.meta.url);
                                   ~~~~~~~~~~~
Found 18 error(s).
/app/notificaciones-backend:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  notificaciones-backend@0.0.1 build: `nest build`
Exit status 1
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm --filter notificaciones-backend build" did not complete successfully: exit code: 1 >



You reached the start of the range
2026-08-21 22:58
scheduling build on Metal builder "builder-fumiuy"
unpacking archive
29.7 MB
168ms
uploading snapshot
9.6 MB
129ms

internal
load build definition from notificaciones-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
342ms

internal
load .dockerignore
0ms

internal
load build context
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
9ms

runner
WORKDIR /app cached
0ms

runner
RUN apk add --no-cache dumb-init cached
0ms

base
WORKDIR /app cached
0ms

base
RUN npm install -g pnpm@10 cached
0ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs
267ms

deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
109ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json
64ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json
64ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
72ms

deps
COPY notificaciones-backend/package.json                 ./notificaciones-backend/package.json
67ms

deps
RUN pnpm install --frozen-lockfile
5s
Done in 4.3s using pnpm v10.34.5

builder
COPY tsconfig.base.json     ./
399ms

builder
COPY packages/proto/        ./packages/proto/
73ms

builder
COPY packages/auth-server/  ./packages/auth-server/
70ms

builder
COPY packages/grpc-client/  ./packages/grpc-client/
91ms

builder
COPY notificaciones-backend/                  ./notificaciones-backend/
124ms

builder
RUN pnpm --filter notificaciones-backend build
3s
> notificaciones-backend@0.0.1 build /app/notificaciones-backend
> nest build
src/grpc/notificaciones-grpc.controller.ts:12:38 - error TS2339: Property 'notificationId' does not exist on type '{ jobId: string; channel: string; }'.
12     return { notification_id: result.notificationId, status: result.status, message: "OK" };
                                        ~~~~~~~~~~~~~~
src/grpc/notificaciones-grpc.controller.ts:12:69 - error TS2339: Property 'status' does not exist on type '{ jobId: string; channel: string; }'.
12     return { notification_id: result.notificationId, status: result.status, message: "OK" };
                                                                       ~~~~~~
src/health/health.controller.ts:31:47 - error TS2345: Argument of type 'PrismaService' is not assignable to parameter of type 'PrismaClient'.
31       () => this.prisma.pingCheck('database', this.db),
                                                 ~~~~~~~
src/health/health.controller.ts:40:47 - error TS2345: Argument of type 'PrismaService' is not assignable to parameter of type 'PrismaClient'.
40       () => this.prisma.pingCheck('database', this.db),
                                                 ~~~~~~~
src/notifications/dlq/dlq-monitor.service.ts:39:58 - error TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled.
39     @Inject('CHATIA_GRPC_CLIENT') private readonly grpc: ClientGrpc,
                                                            ~~~~~~~~~~
  src/notifications/dlq/dlq-monitor.service.ts:13:10
    13 import { ClientGrpc }                                from '@nestjs/microservices';
                ~~~~~~~~~~
    'ClientGrpc' was imported here.
src/notifications/notifications.service.ts:65:33 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
65     const n = await this.prisma.notification.findUnique({ where: { id } });
                                   ~~~~~~~~~~~~
src/notifications/notifications.service.ts:88:39 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
88     const grouped = await this.prisma.notification.groupBy({
                                         ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:38:40 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
38     const existing = await this.prisma.notification.findUnique({
                                          ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:47:36 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
47     const pref = await this.prisma.contactPreference.findUnique({
                                      ~~~~~~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:78:25 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
78       await this.prisma.notification.update({
                           ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:85:25 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
85       await this.prisma.notification.update({
                           ~~~~~~~~~~~~
src/notifications/processors/notification.processor.ts:103:24 - error TS2339: Property 'notification' does not exist on type 'PrismaService'.
103     return this.prisma.notification.upsert({
                           ~~~~~~~~~~~~
src/preferences/preferences.service.ts:7:24 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
7     return this.prisma.contactPreference.findMany({ where: { organizationId, contactId } });
                         ~~~~~~~~~~~~~~~~~
src/preferences/preferences.service.ts:10:24 - error TS2339: Property 'contactPreference' does not exist on type 'PrismaService'.
10     return this.prisma.contactPreference.upsert({
                          ~~~~~~~~~~~~~~~~~
src/prisma/prisma.service.ts:2:10 - error TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'.
2 import { PrismaClient } from '@prisma/client';
           ~~~~~~~~~~~~
src/prisma/prisma.service.ts:21:16 - error TS2339: Property '$connect' does not exist on type 'PrismaService'.
21     await this.$connect();
                  ~~~~~~~~
src/prisma/prisma.service.ts:26:16 - error TS2339: Property '$disconnect' does not exist on type 'PrismaService'.
26     await this.$disconnect();
                  ~~~~~~~~~~~
../packages/proto/src/index.ts:3:34 - error TS1470: The 'import.meta' meta-property is not allowed in files which will build into CommonJS output.
3 const __filename = fileURLToPath(import.meta.url);
                                   ~~~~~~~~~~~
Found 18 error(s).
/app/notificaciones-backend:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  notificaciones-backend@0.0.1 build: `nest build`
Exit status 1
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm --filter notificaciones-backend build" did not complete successfully: exit code: 1 >


You reached the start of the range
2026-08-21 22:58
unpacking archive
29.7 MB
174ms
uploading snapshot
9.6 MB
141ms

internal
load build definition from workers-backend/Dockerfile
0ms

internal
load metadata for docker.io/library/node:24-alpine
345ms

internal
load .dockerignore
0ms

internal
load build context
0ms

base
FROM docker.io/library/node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
9ms

runner
WORKDIR /app cached
1ms

runner
RUN apk add --no-cache dumb-init cached
0ms

base
WORKDIR /app cached
1ms

base
RUN npm install -g pnpm@10 cached
0ms

runner
RUN addgroup --system --gid 1001 nodejs  && adduser  --system --uid 1001 nestjs
687ms

deps
COPY pnpm-workspace.yaml package.json .npmrc pnpm-lock.yaml ./
258ms

deps
COPY packages/proto/package.json       ./packages/proto/package.json
72ms

deps
COPY packages/auth-server/package.json ./packages/auth-server/package.json
85ms

deps
COPY packages/grpc-client/package.json ./packages/grpc-client/package.json
136ms

deps
COPY workers-backend/package.json                 ./workers-backend/package.json
76ms

deps
RUN pnpm install --frozen-lockfile
5s
Done in 4.3s using pnpm v10.34.5

builder
COPY tsconfig.base.json     ./
405ms

builder
COPY packages/proto/        ./packages/proto/
67ms

builder
COPY packages/auth-server/  ./packages/auth-server/
70ms

builder
COPY packages/grpc-client/  ./packages/grpc-client/
68ms

builder
COPY workers-backend/                  ./workers-backend/
88ms

builder
RUN pnpm --filter workers-backend build
3s
> workers-backend@0.0.1 build /app/workers-backend
> nest build
../packages/proto/src/index.ts:3:34 - error TS1470: The 'import.meta' meta-property is not allowed in files which will build into CommonJS output.
3 const __filename = fileURLToPath(import.meta.url);
                                   ~~~~~~~~~~~
src/campaigns/campaigns.service.ts:30:40 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
30     const campaign = await this.prisma.campaign.create({
                                          ~~~~~~~~
src/campaigns/campaigns.service.ts:46:24 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
46     return this.prisma.campaign.findMany({
                          ~~~~~~~~
src/campaigns/campaigns.service.ts:57:33 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
57     const c = await this.prisma.campaign.findFirst({
                                   ~~~~~~~~
src/campaigns/campaigns.service.ts:75:24 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
75     return this.prisma.campaign.update({
                          ~~~~~~~~
src/campaigns/campaigns.service.ts:105:37 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
105       const due = await this.prisma.campaign.findMany({
                                        ~~~~~~~~
src/campaigns/campaigns.service.ts:126:40 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
126     const campaign = await this.prisma.campaign.findUnique({
                                           ~~~~~~~~
src/campaigns/campaigns.service.ts:132:23 - error TS2339: Property 'campaign' does not exist on type 'PrismaService'.
132     await this.prisma.campaign.update({
                          ~~~~~~~~
src/dlq/dlq.module.ts:7:60 - error TS2551: Property 'FAQ_INGEST_DLQ' does not exist on type '{ readonly FAQ_INGEST: "workers.faq-ingest"; readonly VECTOR_INDEX: "workers.vector-index"; readonly CAMPAIGN_EMAIL: "workers.campaign-email"; readonly ANALYTICS_EXPORT: "workers.analytics-export"; readonly DLQ_FAQ_INGEST: "workers.faq-ingest.dlq"; readonly DLQ_VECTOR_INDEX: "workers.vector-index.dlq"; readonly DLQ_...'. Did you mean 'FAQ_INGEST'?
7   imports: [BullModule.registerQueue({ name: WORKER_QUEUES.FAQ_INGEST_DLQ }, { name: WORKER_QUEUES.VECTOR_INDEX_DLQ }, { name: WORKER_QUEUES.CAMPAIGN_EMAIL_DLQ }, { name: WORKER_QUEUES.ANALYTICS_EXPORT_DLQ })],
                                                             ~~~~~~~~~~~~~~
  src/jobs/jobs.constants.ts:7:3
    7   FAQ_INGEST:       'workers.faq-ingest',
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    'FAQ_INGEST' is declared here.
src/dlq/dlq.module.ts:7:100 - error TS2551: Property 'VECTOR_INDEX_DLQ' does not exist on type '{ readonly FAQ_INGEST: "workers.faq-ingest"; readonly VECTOR_INDEX: "workers.vector-index"; readonly CAMPAIGN_EMAIL: "workers.campaign-email"; readonly ANALYTICS_EXPORT: "workers.analytics-export"; readonly DLQ_FAQ_INGEST: "workers.faq-ingest.dlq"; readonly DLQ_VECTOR_INDEX: "workers.vector-index.dlq"; readonly DLQ_...'. Did you mean 'VECTOR_INDEX'?
7   imports: [BullModule.registerQueue({ name: WORKER_QUEUES.FAQ_INGEST_DLQ }, { name: WORKER_QUEUES.VECTOR_INDEX_DLQ }, { name: WORKER_QUEUES.CAMPAIGN_EMAIL_DLQ }, { name: WORKER_QUEUES.ANALYTICS_EXPORT_DLQ })],
                                                                                                     ~~~~~~~~~~~~~~~~
  src/jobs/jobs.constants.ts:8:3
    8   VECTOR_INDEX:     'workers.vector-index',
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    'VECTOR_INDEX' is declared here.
src/dlq/dlq.module.ts:7:142 - error TS2551: Property 'CAMPAIGN_EMAIL_DLQ' does not exist on type '{ readonly FAQ_INGEST: "workers.faq-ingest"; readonly VECTOR_INDEX: "workers.vector-index"; readonly CAMPAIGN_EMAIL: "workers.campaign-email"; readonly ANALYTICS_EXPORT: "workers.analytics-export"; readonly DLQ_FAQ_INGEST: "workers.faq-ingest.dlq"; readonly DLQ_VECTOR_INDEX: "workers.vector-index.dlq"; readonly DLQ_...'. Did you mean 'CAMPAIGN_EMAIL'?
7   imports: [BullModule.registerQueue({ name: WORKER_QUEUES.FAQ_INGEST_DLQ }, { name: WORKER_QUEUES.VECTOR_INDEX_DLQ }, { name: WORKER_QUEUES.CAMPAIGN_EMAIL_DLQ }, { name: WORKER_QUEUES.ANALYTICS_EXPORT_DLQ })],
                                                                                                                                               ~~~~~~~~~~~~~~~~~~
  src/jobs/jobs.constants.ts:9:3
    9   CAMPAIGN_EMAIL:   'workers.campaign-email',
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    'CAMPAIGN_EMAIL' is declared here.
src/dlq/dlq.module.ts:7:186 - error TS2551: Property 'ANALYTICS_EXPORT_DLQ' does not exist on type '{ readonly FAQ_INGEST: "workers.faq-ingest"; readonly VECTOR_INDEX: "workers.vector-index"; readonly CAMPAIGN_EMAIL: "workers.campaign-email"; readonly ANALYTICS_EXPORT: "workers.analytics-export"; readonly DLQ_FAQ_INGEST: "workers.faq-ingest.dlq"; readonly DLQ_VECTOR_INDEX: "workers.vector-index.dlq"; readonly DLQ_...'. Did you mean 'ANALYTICS_EXPORT'?
7   imports: [BullModule.registerQueue({ name: WORKER_QUEUES.FAQ_INGEST_DLQ }, { name: WORKER_QUEUES.VECTOR_INDEX_DLQ }, { name: WORKER_QUEUES.CAMPAIGN_EMAIL_DLQ }, { name: WORKER_QUEUES.ANALYTICS_EXPORT_DLQ })],
                                                                                                                                                                                           ~~~~~~~~~~~~~~~~~~~~
  src/jobs/jobs.constants.ts:10:3
    10   ANALYTICS_EXPORT: 'workers.analytics-export',
         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    'ANALYTICS_EXPORT' is declared here.
src/dlq/dlq.service.ts:43:22 - error TS2345: Argument of type '{ queue: string; jobId: string; failedReason: string; attempts: number; failedAt: number; data: any; }' is not assignable to parameter of type 'never'.
 43         results.push({
                         ~
 44           queue:        queueName,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
... 
 49           data:         job.data,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 50         });
    ~~~~~~~~~
src/dlq/dlq.service.ts:54:37 - error TS2339: Property 'failedAt' does not exist on type 'never'.
54     return results.sort((a, b) => b.failedAt - a.failedAt);
                                       ~~~~~~~~
src/dlq/dlq.service.ts:54:50 - error TS2339: Property 'failedAt' does not exist on type 'never'.
54     return results.sort((a, b) => b.failedAt - a.failedAt);
                                                    ~~~~~~~~
src/dlq/dlq.service.ts:66:23 - error TS2339: Property 'jobLog' does not exist on type 'PrismaService'.
66     await this.prisma.jobLog.updateMany({
                         ~~~~~~
src/dlq/dlq.service.ts:83:23 - error TS2339: Property 'jobLog' does not exist on type 'PrismaService'.
83     await this.prisma.jobLog.updateMany({
                         ~~~~~~
src/dlq/dlq.service.ts:110:18 - error TS2345: Argument of type '{ queue: string; failed: number; warning: boolean; critical: boolean; }' is not assignable to parameter of type 'never'.
110       stats.push({
                     ~
111         queue:    queueName,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
... 
114         critical: failed >= DLQ_MAX_THRESHOLD,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
115       });
    ~~~~~~~
src/health/health.controller.ts:8:72 - error TS2345: Argument of type 'PrismaService' is not assignable to parameter of type 'PrismaClient'.
8   check() { return this.h.check([() => this.pi.pingCheck("workers_db", this.db)]); }
                                                                         ~~~~~~~
src/jobs/jobs.service.ts:8:35 - error TS2339: Property 'jobLog' does not exist on type 'PrismaService'.
8     const log = await this.prisma.jobLog.findUnique({ where: { jobId } });
                                    ~~~~~~
src/jobs/jobs.service.ts:13:24 - error TS2339: Property 'jobLog' does not exist on type 'PrismaService'.
13     return this.prisma.jobLog.create({ data: { ...data, input: data.input as any, status: "PENDING" } });
                          ~~~~~~
src/jobs/jobs.service.ts:16:24 - error TS2339: Property 'jobLog' does not exist on type 'PrismaService'.
16     return this.prisma.jobLog.update({ where: { jobId }, data: { ...update, result: update.result as any } })
                          ~~~~~~
src/jobs/processors/analytics-export.processor.ts:45:61 - error TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled.
45     @Inject('ANALYTICS_GRPC_CLIENT') private readonly grpc: ClientGrpc,
                                                               ~~~~~~~~~~
  src/jobs/processors/analytics-export.processor.ts:11:10
    11 import { ClientGrpc }            from '@nestjs/microservices';
                ~~~~~~~~~~
    'ClientGrpc' was imported here.
src/jobs/processors/campaign-email.processor.ts:48:65 - error TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled.
48     @Inject('NOTIF_GRPC_CLIENT')    private readonly notifGrpc: ClientGrpc,
                                                                   ~~~~~~~~~~
  src/jobs/processors/campaign-email.processor.ts:16:10
    16 import { ClientGrpc }            from '@nestjs/microservices';
                ~~~~~~~~~~
    'ClientGrpc' was imported here.
src/jobs/processors/vector-index.processor.ts:39:58 - error TS1272: A type referenced in a decorated signature must be imported with 'import type' or a namespace import when 'isolatedModules' and 'emitDecoratorMetadata' are enabled.
39     @Inject('CHATIA_GRPC_CLIENT') private readonly grpc: ClientGrpc,
                                                            ~~~~~~~~~~
  src/jobs/processors/vector-index.processor.ts:11:10
    11 import { ClientGrpc }            from '@nestjs/microservices';
                ~~~~~~~~~~
    'ClientGrpc' was imported here.
src/jobs/services/chunking.service.ts:8:40 - error TS2307: Cannot find module '../dto/faq-ingest-job.dto.js' or its corresponding type declarations.
8 import type { FaqDocumentSource } from '../dto/faq-ingest-job.dto.js';
                                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
src/jobs/services/chunking.service.ts:58:40 - error TS2307: Cannot find module 'pdf-parse' or its corresponding type declarations.
58         const pdfParse = (await import('pdf-parse')).default;
                                          ~~~~~~~~~~~
src/jobs/services/chunking.service.ts:66:38 - error TS2307: Cannot find module 'mammoth' or its corresponding type declarations.
66         const mammoth = await import('mammoth');
                                        ~~~~~~~~~
src/prisma/prisma.service.ts:2:10 - error TS2305: Module '"@prisma/client"' has no exported member 'PrismaClient'.
2 import { PrismaClient } from '@prisma/client';
           ~~~~~~~~~~~~
src/prisma/prisma.service.ts:21:16 - error TS2339: Property '$connect' does not exist on type 'PrismaService'.
21     await this.$connect();
                  ~~~~~~~~
src/prisma/prisma.service.ts:26:16 - error TS2339: Property '$disconnect' does not exist on type 'PrismaService'.
26     await this.$disconnect();
                  ~~~~~~~~~~~
Found 31 error(s).
/app/workers-backend:
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  workers-backend@0.0.1 build: `nest build`
Exit status 1
Build Failed: build daemon returned an error < failed to solve: process "/bin/sh -c pnpm --filter workers-backend build" did not complete successfully: exit code: 1