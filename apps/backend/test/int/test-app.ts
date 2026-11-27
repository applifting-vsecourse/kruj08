import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { EmailService } from '@/core/email/interfaces/email-service.interface';
import { PrismaService } from '@/core/prisma/prisma.service';
import { Config } from '@/shared/config/config.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import TestAgent from 'supertest/lib/agent';

export type SentEmail = { to: string; subject: string; html: string };

// Stands in for Resend / SMTP / the console mailer, whichever apps/backend/.env
// would pick: a test signs up accounts at example.com and must never send
// real mail. The e-mails are kept so a test can assert on them.
export class RecordingEmailService implements EmailService {
  readonly sent: SentEmail[] = [];

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    this.sent.push({ to, subject, html });
  }
}

// The app the *.int-spec.ts tests talk to: AppModule with the same HTTP
// pipeline main.ts sets up (configureApp), not listening on a port —
// supertest binds it to a free one per request. DATABASE_URL already points
// at the test database (test/db/setup-env.ts). Its RecordingEmailService is
// `app.get<RecordingEmailService>('EmailService')`.
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('EmailService')
    .useValue(new RecordingEmailService())
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return app;
}

// Every table but Prisma's migration log, so each test starts from an empty
// database whatever tables the schema has grown since this was written.
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

// A visitor who has not signed in. Sends the Origin the frontend would,
// because BetterAuth accepts auth requests from its trusted origins only.
export function anonymous(app: INestApplication): TestAgent {
  return request
    .agent(app.getHttpServer())
    .set('Origin', app.get(Config).frontendUrl);
}

// A new account, signed in the way the app signs one in: through BetterAuth's
// own sign-up endpoint, which answers with the session cookie. The agent keeps
// that cookie and sends it with every later request.
export async function signedUp(
  app: INestApplication,
  name: string,
): Promise<TestAgent> {
  const agent = anonymous(app);
  await agent
    .post('/api/auth/sign-up/email')
    .send({ name, email: `${name}@example.com`, password: `${name}-password` })
    .expect(200);
  return agent;
}
