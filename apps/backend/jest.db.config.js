// Jest for the *.db-spec.ts tests, which run against a real Postgres: a test
// database rebuilt on every run (see test/db/). Otherwise the same setup as
// the unit tests configured in package.json, which never match these files.
const { jest: unitTests } = require('./package.json');

module.exports = {
  ...unitTests,
  testRegex: '\\.db-spec\\.ts$',
  globalSetup: '<rootDir>/test/db/global-setup.ts',
  setupFiles: ['<rootDir>/test/db/setup-env.ts'],
};
