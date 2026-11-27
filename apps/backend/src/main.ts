import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { Config } from './shared/config/config.service';

/**
 * Main application entry point
 * Initializes and configures the NestJS application
 */
async function main(): Promise<void> {
  // Create NestJS application instance
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Get configuration service
  const config = app.get(Config);

  // CORS, cookies, BetterAuth, body parsing and the /api prefix
  configureApp(app);

  // Setup Swagger API documentation at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.name)
    .setDescription(config.description)
    .setVersion(config.version)
    .addServer('/api')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Print debug information for development purposes
  if (config.nodeEnv !== 'production') {
    console.log('App configuration:', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      backendUrl: config.backendUrl,
      frontendUrl: config.frontendUrl,
    });
  }

  // Start the application
  await app.listen(config.port);
  console.log(`Application is running on: ${config.backendUrl}`);
}

// Execute the main function
main().catch((error) => console.error('Application error:', error));
