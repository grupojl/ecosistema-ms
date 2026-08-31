# Convenciones de Testing

## Stack
- **Unit**: Jest + `@nestjs/testing`
- **Integration**: Supertest (HTTP) + gRPC client de test
- **E2E**: pendiente (S4)

## Cobertura mínima
- 85% en paths críticos (pagos, auth, procesamiento de mensajes)
- 70% general en el resto

## Estructura de tests por microservicio

```
{servicio}/src/
  {dominio}/
    {dominio}.service.spec.ts      # unit — lógica de dominio
    {dominio}.controller.spec.ts   # unit — surface HTTP
  test/
    {dominio}.e2e-spec.ts          # integration — contrato HTTP completo
```

## Patrón de test unitario (service)

```typescript
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma:  DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma  = module.get(PrismaService);
  });

  it('should throw NotFoundException when payment not found', async () => {
    prisma.payment.findUnique.mockResolvedValue(null);
    await expect(service.findOne('id-inexistente', ctx)).rejects.toThrow(NotFoundException);
  });
});
```

## Tenant context en tests

```typescript
const mockCtx: TenantContext = {
  ecosystemId:    'test-ecosystem',
  organizationId: 'test-org',
  userId:         'user-123',
  role:           'ADMIN',
};
```

## Jobs BullMQ en tests

```typescript
// Mockear el queue — no correr Redis en tests unitarios
{ provide: getQueueToken(QUEUE_NAME), useValue: { add: jest.fn() } }
```
