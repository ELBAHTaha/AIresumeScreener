import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { createLogger, format, transports } from 'winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';

const isProduction = process.env.NODE_ENV === 'production';

const winstonLogger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
    : format.combine(
        format.timestamp({ format: 'HH:mm:ss' }),
        format.errors({ stack: true }),
        format.colorize(),
        format.printf(({ timestamp, level, message, context }) =>
          `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
        ),
      ),
  transports: [
    new transports.Console(),
    ...(isProduction
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({ instance: winstonLogger }),
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('AI Resume Screener — API Gateway')
    .setDescription(`
## AI-Powered Resume Screening Platform

Routes requests to microservices:
- **Auth Service** (port 3001): Register, login, JWT verification
- **Job Service** (port 3002): Job postings, resume uploads, applications
- **AI Screener Service** (port 3003): Claude-powered screening & ranking

All endpoints except /auth/register and /auth/login require a Bearer JWT token.
    `)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  winstonLogger.info(`🚪 API Gateway running on port ${port}`);
  winstonLogger.info(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
