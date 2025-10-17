import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { createClient, SetOptions } from "redis";
import { REDIS_CLIENT } from "src/redis/redis.module";

@Injectable()
export class MemoryStoreService {
  constructor(
    @Inject(REDIS_CLIENT) private redisClient: ReturnType<typeof createClient>,
  ) {}

  async save(
    key: string,
    value: any,
    options?: SetOptions &
      ({ isRevoked?: false } | { isRevoked: true; ttlInSecs: number }),
  ) {
    try {
      if (options && options.isRevoked) {
        return this.redisClient.setEx(key, options.ttlInSecs, value);
      }
      return this.redisClient.set(key, value, options);
    } catch (err) {
      throw new InternalServerErrorException(
        "Error occured while writing to memory store",
        err.message,
      );
    }
  }

  async get(key: string) {
    return this.redisClient.get(key);
  }

  async delete(key: string) {
    return this.redisClient.del(key);
  }
}
