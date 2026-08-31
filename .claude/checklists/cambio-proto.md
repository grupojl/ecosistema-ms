# Checklist: Cambio en archivo .proto

## Evaluación inicial
- [ ] ¿Es un cambio aditivo (nuevo campo, nuevo método)? → proceder
- [ ] ¿Es un breaking change (renombrar, eliminar, cambiar tipo)? → requiere ADR + deprecation period

## Cambio aditivo
- [ ] Nuevo campo con número de campo nuevo (nunca reusar números)
- [ ] Nuevo método si aplica
- [ ] Actualizar `packages/grpc-client/src/{servicio}/{servicio}-grpc.module.ts`
- [ ] Implementar en el server: `{servicio}-grpc.controller.ts`
- [ ] Verificar que consumers existentes no se rompen

## Breaking change (si aplica)
- [ ] ADR creado y aprobado
- [ ] Nuevo método con sufijo `V2` (mantener el viejo funcionando)
- [ ] Comunicar a todos los microservicios que consumen este proto
- [ ] Plan de migración definido (sprint completo mínimo)

## Deploy
- [ ] Deploy del servidor primero (nuevo método disponible)
- [ ] Deploy de los clientes (empiezan a usar el nuevo método)
- [ ] Verificar en Railway que todos los health checks pasan
