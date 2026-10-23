import 'dotenv/config';
import { devDatabaseUrl, testDatabaseUrl } from './test-database';

// Runs before each *.db-spec.ts file. Everything a test constructs, the
// PrismaService included, reads DATABASE_URL, so pointing it at the test
// database here keeps every test off the dev data.
process.env.DATABASE_URL = testDatabaseUrl(devDatabaseUrl());
