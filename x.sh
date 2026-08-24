#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix proto paths inline en los 3 servicios nuevos
# Compatible con Git Bash Windows (sin subshells en while read)
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# Función que elimina @ecosistema-ms/proto de un archivo y reemplaza constantes
fix_proto_imports() {
  local FILE="$1"
  [ -f "$FILE" ] || return

  # Agregar import de path si no está y el archivo usa join(process.cwd()...)
  if ! grep -q "from 'path'" "$FILE" && ! grep -q 'from "path"' "$FILE"; then
    # Solo agregar si necesitamos path (si usa alguna constante de proto)
    grep -q "PROTO_PATH\|_PACKAGE" "$FILE" && \
      sed -i "1s|^|import { join } from 'path';\n|" "$FILE" || true
  fi

  # Eliminar líneas de import de @ecosistema-ms/proto
  sed -i "s|.*from '@ecosistema-ms/proto'.*||g" "$FILE"
  sed -i "s|.*from \"@ecosistema-ms/proto\".*||g" "$FILE"

  # Reemplazar constantes de PATH por valores inline
  sed -i "s|NOTIF_PROTO_PATH|join(process.cwd(), 'proto', 'notificaciones.proto')|g" "$FILE"
  sed -i "s|CHATIA_PROTO_PATH|join(process.cwd(), 'proto', 'chatia.proto')|g"        "$FILE"
  sed -i "s|ANALYTICS_PROTO_PATH|join(process.cwd(), 'proto', 'analytics.proto')|g" "$FILE"
  sed -i "s|WORKERS_PROTO_PATH|join(process.cwd(), 'proto', 'workers.proto')|g"      "$FILE"
  sed -i "s|PAGOS_PROTO_PATH|join(process.cwd(), 'proto', 'pagos.proto')|g"          "$FILE"

  # Reemplazar constantes de PACKAGE por strings literales
  sed -i "s|NOTIF_PACKAGE|'notificaciones'|g"  "$FILE"
  sed -i "s|CHATIA_PACKAGE|'chatia'|g"         "$FILE"
  sed -i "s|ANALYTICS_PACKAGE|'analytics'|g"   "$FILE"
  sed -i "s|WORKERS_PACKAGE|'workers'|g"        "$FILE"
  sed -i "s|PAGOS_PACKAGE|'pagos'|g"            "$FILE"
}

# =============================================================================
# main.ts — reescribir los 3 (más limpio que sed)
# =============================================================================
log "[1/4] notificaciones-backend/src/main.ts"
cat > "$ROOT/notificaciones-backend/src/main.ts" << 'EOF'
import { NestFactory }        from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }     from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }               from 'path';
import { AppModule }          from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'notificaciones',
      protoPath:  join(process.cwd(), 'proto', 'notificaciones.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5003}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Notificaciones API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3002);
}
void bootstrap();
EOF
ok "notificaciones-backend/src/main.ts"

log "[2/4] analytics-backend/src/main.ts"
cat > "$ROOT/analytics-backend/src/main.ts" << 'EOF'
import { NestFactory }        from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }     from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }               from 'path';
import { AppModule }          from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'analytics',
      protoPath:  join(process.cwd(), 'proto', 'analytics.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5004}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Analytics API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3003);
}
void bootstrap();
EOF
ok "analytics-backend/src/main.ts"

log "[3/4] workers-backend/src/main.ts"
cat > "$ROOT/workers-backend/src/main.ts" << 'EOF'
import { NestFactory }        from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe }     from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join }               from 'path';
import { AppModule }          from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package:   'workers',
      protoPath:  join(process.cwd(), 'proto', 'workers.proto'),
      url:        `0.0.0.0:${process.env['GRPC_PORT'] ?? 5005}`,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Workers API').setVersion('1.0').addBearerAuth().build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(process.env['PORT'] ?? 3004);
}
void bootstrap();
EOF
ok "workers-backend/src/main.ts"

# =============================================================================
# Fix archivos que usan constantes de @ecosistema-ms/proto — lista explícita
# Evitar find+xargs+while que falla en Git Bash Windows
# =============================================================================
log "[4/4] Fix proto imports en archivos restantes"

# Lista explícita de archivos que sabemos que usan @ecosistema-ms/proto
PROTO_FILES=(
  "$ROOT/workers-backend/src/app.module.ts"
  "$ROOT/notificaciones-backend/src/notifications/dlq/dlq.module.ts"
  "$ROOT/notificaciones-backend/src/grpc/grpc.module.ts"
  "$ROOT/analytics-backend/src/grpc/grpc.module.ts"
  "$ROOT/analytics-backend/src/analytics/export.service.ts"
  "$ROOT/packages/grpc-client/src/analytics/analytics-grpc.module.ts"
  "$ROOT/packages/grpc-client/src/index.ts"
)

for FILE in "${PROTO_FILES[@]}"; do
  if [ -f "$FILE" ] && grep -q "ecosistema-ms/proto" "$FILE" 2>/dev/null; then
    fix_proto_imports "$FILE"
    ok "  $(basename $FILE)"
  fi
done

echo ""
ok "════════════════════════════════════════════════════════"
ok "  Fix aplicado"
ok "════════════════════════════════════════════════════════"
echo ""
echo "Próximo: make g → push → Railway redeploy"