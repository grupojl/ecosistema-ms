# Checklist — Migración class-validator → Zod (ADR-011 Sprint 1)

## Para cada controller migrado, verificar:

- [ ] Schema Zod definido inline en el mismo archivo del controller
- [ ] `z.infer<typeof Schema>` como tipo del parámetro (no una clase DTO)
- [ ] `ZodValidationPipe` en cada endpoint que recibe body
- [ ] `class-validator` eliminado de los imports del archivo
- [ ] El schema incluye `.optional()` solo donde el campo realmente es opcional
- [ ] `z.coerce.number()` para query params numéricos (vienen como string en HTTP)
- [ ] El schema tiene `.min()` / `.max()` en strings — nunca validación implícita

## Verificación final del servicio

```bash
# Cero class-validator fuera de schemas/ (si los hay)
grep -r "@IsString\|@IsEnum\|@IsOptional\|class-validator" \
  <servicio>/src --include="*.ts" | grep -v "schemas\|.spec." | wc -l
# → 0

# ZodValidationPipe presente en todos los endpoints con body
grep -rn "ZodValidationPipe" <servicio>/src --include="*.controller.ts" | wc -l
# → igual al número de endpoints con @Body()

# class-validator eliminado de package.json
grep "class-validator" <servicio>/package.json
# → no debe aparecer
```

## Servicios por migrar (ADR-011)

| Servicio | Estado | Done cuando |
|---------|--------|-------------|
| pasarelapagos-backend | ✅ Completado (Sprint 1) | grep class-validator → 0 ✅ |
| workers-backend | ✅ Completado (Sprint 1) | grep class-validator → 0 ✅ |
| notificaciones-backend | ✅ Ya migrado | — |
| chatia-backend | ✅ Ya migrado | — |
| analytics-backend | ✅ Sin DTOs con class-validator | — |
