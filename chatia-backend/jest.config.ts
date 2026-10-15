// Única configuración de Jest (se quitó la clave `jest` de package.json: tener las dos rompía la resolución).
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  // Specs de plantilla (`should be defined`) de módulos legacy sin código: pendientes de borrar (ver roadmap F3.2)
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json', diagnostics: false }],
  },
  moduleNameMapper: {
    // firebase-admin arrastra jose (ESM puro): en tests unitarios se usa un stub
    '^firebase-admin/app$':  '<rootDir>/infrastructure/testing/stubs/firebase-admin-app.stub.ts',
    '^firebase-admin/auth$': '<rootDir>/infrastructure/testing/stubs/firebase-admin-auth.stub.ts',
    // Alias @/ con extensión .js (NodeNext): se resuelve al .ts real
    '^@/(.*)\\.js$': '<rootDir>/$1',
    '^@/(.*)$':      '<rootDir>/$1',
    // Imports relativos con .js dentro del cliente Prisma generado
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    '**/*.ts',
    '!**/node_modules/**',
    '!generated/**',
    '!infrastructure/testing/**',
    // Adaptadores Prisma (solo SQL): se prueban contra Postgres REAL en infrastructure/testing/integration/*.spec.ts
    // (pnpm test:integration, también en CI). Un mock de Prisma no verifica nada de estas consultas.
    '!infrastructure/prisma/repositories/**',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!**/index.ts', // barriles de re-exportación: sin lógica
    '!main.ts',
    '!**/*.constants.ts',
    '!**/*.interface.ts',
    '!**/*.types.ts',
    '!**/*.d.ts',
    '!**/_deprecated/**',
  ],
  coverageDirectory: '../coverage',
  // json-summary lo lee el skill audit-service (scripts/metrics.js): así la cobertura medida es siempre la última corrida
  coverageReporters: ['text-summary', 'json-summary', 'lcov'],
  testEnvironment:   'node',
  // Umbral de cobertura (solo sube). Medido el 2026-10-15 con tests UNITARIOS: 94,3/85,7/86,0/94,0 (stmts/branches/funcs/lines).
  // Los repositories Prisma se excluyen de este porcentaje y se prueban contra Postgres real (test:integration).
  coverageThreshold: {
    global: { statements: 93, branches: 85, functions: 85, lines: 93 },
  },
};

export default config;
