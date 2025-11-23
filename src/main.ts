import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import session from "express-session";
import { AppModule } from "./app.module";
import { ResponseTransformerInterceptor } from "./interceptors/response.interceptor";
import { ExceptionFilter } from "./interceptors/exception-filter.interceptor";
import { ConfigService } from "@nestjs/config";
import { CORS_WHITELIST_URLS, NODE_ENV, PORT, SESSION_SECRET } from "./config/env/list";

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

  // Setup sessions with in-memory store (Redis disabled)
  const memoryStore = new session.MemoryStore();

  app.use(
    session({
      secret: configService.getOrThrow<string>(SESSION_SECRET),
      name: "sid",
      resave: false,
      store: memoryStore,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        ...(configService.get<string>(NODE_ENV, "development") !== "development"
          ? { sameSite: "none" as const }
          : { sameSite: "lax" }),
        ...(configService.get<string>(NODE_ENV, "development") !== "development" && {
          domain: ".asapcrypto.xyz",
        }),
      },
    }),
  );

  // Get port from config
  const port = configService.getOrThrow<number>(PORT);

  await app.listen(port ?? 3000);
}
bootstrap();
