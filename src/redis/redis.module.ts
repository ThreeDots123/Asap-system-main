import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import {
  NODE_ENV,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_URL,
  DISABLE_REDIS,
} from "src/config/env/list";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const disableRedis =
          configService.get<string>(DISABLE_REDIS, "false") === "true";

        if (disableRedis) {
          // Provide a minimal in-memory stub compatible with MemoryStoreService
          const store = new Map<string, { value: string; expiresAt?: number }>();
          const stub: any = {
            async connect() {
              /* no-op */
              return;
            },
            async set(key: string, value: string) {
              store.set(key, { value });
              return "OK";
            },
            async setEx(key: string, ttlInSecs: number, value: string) {
              const expiresAt = Date.now() + ttlInSecs * 1000;
              store.set(key, { value, expiresAt });
              return "OK";
            },
            async get(key: string) {
              const entry = store.get(key);
              if (!entry) return null;
              if (entry.expiresAt && entry.expiresAt < Date.now()) {
                store.delete(key);
                return null;
              }
              return entry.value;
            },
            async del(key: string) {
              const existed = store.has(key);
              store.delete(key);
              return existed ? 1 : 0;
            },
          };
          return stub;
        }

        // Get Redis configuration from environment variables
        const host = configService.getOrThrow<string>(REDIS_HOST);
        const port = configService.getOrThrow<number>(REDIS_PORT);
        const password = configService.getOrThrow<string>(REDIS_PASSWORD);
        const url = configService.getOrThrow<string>(REDIS_URL);

        // Create and return the Redis client instance
        const client = createClient({
          ...(configService.getOrThrow<string>(NODE_ENV) === "production"
            ? { url }
            : {
                socket: {
                  host,
                  port,
                },
                ...(configService.getOrThrow<string>(NODE_ENV) ===
                  "production" && {
                  password,
                }),
              }),
        });

        await client.connect();
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
