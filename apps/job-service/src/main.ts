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
    .setTitle('Job Service')
    .setDescription('Job postings and candidate applications API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT || 3002;
  await app.listen(port);
  winstonLogger.info(`💼 Job Service running on port ${port}`);
}
bootstrap();
