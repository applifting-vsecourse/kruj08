// Jest for the *.int-spec.ts integration tests (`pnpm backend test:int`): the
// whole Nest app, BetterAuth included, answering real HTTP requests (supertest)
// against a real Postgres. Same test database as the *.db-spec.ts tests — a
// `quacker_test` next to the dev one, rebuilt from the migrations on every run
// (see test/db/) — so run the two one after the other, never side by side.
const { jest: unitTests } = require('./package.json');

module.exports = {
  ...unitTests,
  testRegex: '\\.int-spec\\.ts$',
  globalSetup: '<rootDir>/test/db/global-setup.ts',
  setupFiles: ['<rootDir>/test/db/setup-env.ts'],
  // The app imports the e-mail templates, which are .tsx.
  moduleFileExtensions: [...unitTests.moduleFileExtensions, 'tsx', 'mjs'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    // BetterAuth and several of its dependencies ship ES modules only (some
    // as .mjs, some as .js in a "type": "module" package), which Jest's
    // CommonJS runtime cannot load as they are. Transpile every JavaScript
    // file to CommonJS, node_modules included — syntax only, no type-check,
    // and Jest caches the result, so only the first run is slow. .cjs too:
    // react-email renders through a dynamic `import()`, which Jest refuses
    // without --experimental-vm-modules; compiled to CommonJS it becomes a
    // plain require. The unit tests never import BetterAuth and keep the
    // default.
    '^.+\\.[cm]?js$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: { allowJs: true, module: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: [],
};
