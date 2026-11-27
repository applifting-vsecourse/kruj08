import { INestApplication } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { BetterAuth } from './shared/auth/providers/better-auth.provider';
import { Config } from './shared/config/config.service';

/**
 * Everything the HTTP pipeline needs before `listen()` / `init()`: CORS,
 * cookies, the BetterAuth routes, body parsing and the `/api` prefix.
 *
 * Shared by `main.ts` and the integration tests (`*.int-spec.ts`), so a test
 * request goes through the same middleware, in the same order, as one from
 * the browser. The order matters: BetterAuth reads the raw body itself, so it
 * is mounted before `express.json()`.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(Config);

  // Allows cross-origin requests from specific origins
  app.enableCors({
    origin: [config.backendUrl, config.frontendUrl],
    credentials: true,
  });

  app.use(cookieParser());

  const appInstance = app.getHttpAdapter().getInstance();
  const betterAuth = app.get<BetterAuth>('BetterAuth');
  // Express 5 (via NestJS 11) requires named wildcards — a bare `*` throws.
  appInstance.all('/api/auth/*splat', toNodeHandler(betterAuth));
  appInstance.use(express.json());

  app.setGlobalPrefix('api');
}
