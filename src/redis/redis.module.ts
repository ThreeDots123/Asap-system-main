import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import {
  NODE_ENV,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_URL,
} from "src/config/env/list";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
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
                // ... Some options are missing which may be required in prod
              }),
        });

        await client.connect(); // <-- Connect explicitly
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
