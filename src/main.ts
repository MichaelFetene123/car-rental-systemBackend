import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );

  const configuredOrigins =
    process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL;
  const allowedOrigins = configuredOrigins
    ? configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : true;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.use('/uploads', serveStatic(join(process.cwd(), 'uploads')));

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  await app.listen(process.env.PORT ?? 5001);
}
bootstrap();
