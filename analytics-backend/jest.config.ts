import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom:  [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.constants.ts',
    '!**/*.interface.ts',
    '!**/*.types.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment:   'node',
  coverageThreshold: {
    global: {
      statements: 85,
      branches:   80,
      functions:  85,
      lines:      85,
    },
  },
};

export default config;
