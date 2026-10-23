import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
// Relative, not `@/`: Jest loads global setup outside its module mapper.
import { PrismaClient } from '../../src/generated/prisma/client';
import { databaseName, devDatabaseUrl, testDatabaseUrl } from './test-database';

// Runs once before `pnpm backend test:db`: drops the test database, creates
// it again and applies every migration, so the tests see exactly the schema
// the migrations produce and nothing a previous run left behind.
export default async function globalSetup(): Promise<void> {
  const devUrl = devDatabaseUrl();
  const testUrl = testDatabaseUrl(devUrl);
  const name = databaseName(testUrl);

  // Connected to the dev database only to create the test one next to it.
  const server = new PrismaClient({
    adapter: new PrismaPg({ connectionString: devUrl }),
  });
  try {
    await server.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    );
    await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await server.$disconnect();
  }

  // Quiet unless it fails; the error then carries prisma's output.
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}
