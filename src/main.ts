import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import session from "express-session";
import * as connectRedis from "connect-redis";
import Redis from "ioredis";
import { AppModule } from "./app.module";
import { ResponseTransformerInterceptor } from "./interceptors/response.interceptor";
import { ExceptionFilter } from "./interceptors/exception-filter.interceptor";
import { ConfigService } from "@nestjs/config";
import {
  CORS_WHITELIST_URLS,
  NODE_ENV,
  PORT,
  SESSION_SECRET,
} from "./config/env/list";
import { REDIS_CLIENT } from "./redis/redis.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enabling validation globally with dto files
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Enable CORS with configuration
  app.enableCors({
    origin: configService.getOrThrow<string>(CORS_WHITELIST_URLS).split(","),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Allow cookies to be sent
  });

  //* Register the response interceptor
  app.useGlobalInterceptors(new ResponseTransformerInterceptor());

  //* Handle Exceptions
  app.useGlobalFilters(new ExceptionFilter());

  // Setup sessions with redis
  const redisClient = app.get<Redis>(REDIS_CLIENT);

  // @ts-ignore
  const redisStore = new connectRedis.RedisStore({
    client: redisClient,
    prefix: "asap",
    ttl: 1,
  });

  app.use(
    session({
      secret: configService.getOrThrow<string>(SESSION_SECRET),
      name: "sid",
      resave: false,
      store: redisStore,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        maxAge: 30 * 24 * 60 * 60 * 1000, // 7 days
        ...(configService.get<string>(NODE_ENV, "development") !==
          "development" && { sameSite: "none" as const }),
        ...(configService.get<string>(NODE_ENV, "development") !==
          "development" && { domain: ".asapcrypto.xyz" }),
      },
    }),
  );

  // Get port from config
  const port = configService.getOrThrow<number>(PORT);

  await app.listen(port ?? 3000);
}
bootstrap();
