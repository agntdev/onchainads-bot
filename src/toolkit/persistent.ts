/**
 * Small durable key/value store for domain records. Collections must keep their
 * own index records; this API intentionally has no list/scan operation.
 */
export interface PersistentStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

type WorkerBindings = {
  CHAT_DO?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> };
  };
};

class MemoryPersistentStore implements PersistentStore {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, value); }
  async delete(key: string): Promise<void> { this.values.delete(key); }
}

class RedisPersistentStore implements PersistentStore {
  private client: Promise<{ get(key: string): Promise<string | null>; set(key: string, value: string): Promise<unknown>; del(key: string): Promise<unknown> }> | null = null;
  constructor(private readonly url: string) {}
  private async redis() {
    this.client ??= (async () => {
      const { createRequire } = await import("node:module");
      const require = createRequire(import.meta.url);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = require("ioredis");
      const Redis = mod.default ?? mod.Redis ?? mod;
      return new Redis(this.url, { maxRetriesPerRequest: null, lazyConnect: false });
    })();
    return this.client;
  }
  async get<T>(key: string): Promise<T | undefined> {
    const raw = await (await this.redis()).get(key);
    if (raw === null) return undefined;
    try { return JSON.parse(raw) as T; } catch { return undefined; }
  }
  async put<T>(key: string, value: T): Promise<void> { await (await this.redis()).set(key, JSON.stringify(value)); }
  async delete(key: string): Promise<void> { await (await this.redis()).del(key); }
}

class WorkerPersistentStore implements PersistentStore {
  constructor(private readonly bindings: WorkerBindings) {}
  private stub() {
    const ns = this.bindings.CHAT_DO;
    if (!ns) throw new Error("Persistent storage isn't configured.");
    return ns.get(ns.idFromName("crypto-ad-slots-data"));
  }
  async get<T>(key: string): Promise<T | undefined> {
    const response = await this.stub().fetch(`https://do/data?key=${encodeURIComponent(key)}`);
    return response.status === 204 ? undefined : await response.json() as T;
  }
  async put<T>(key: string, value: T): Promise<void> {
    await this.stub().fetch("https://do/data", { method: "PUT", body: JSON.stringify({ key, value }) });
  }
  async delete(key: string): Promise<void> {
    await this.stub().fetch(`https://do/data?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  }
}

/** One store per bot factory. The in-memory branch is harness-only; deployed
 * Node bots use Redis and Workers use Durable Object storage. */
export function createPersistentStore(getEnv: () => WorkerBindings | undefined): PersistentStore {
  const nodeUrl = typeof process === "undefined" ? undefined : process.env.REDIS_URL;
  const fallback = new MemoryPersistentStore();
  const redis = nodeUrl ? new RedisPersistentStore(nodeUrl) : undefined;
  return {
    get: async <T>(key: string) => {
      const env = getEnv();
      if (env?.CHAT_DO) return new WorkerPersistentStore(env).get<T>(key);
      return redis ? redis.get<T>(key) : fallback.get<T>(key);
    },
    put: async <T>(key: string, value: T) => {
      const env = getEnv();
      if (env?.CHAT_DO) return new WorkerPersistentStore(env).put(key, value);
      return redis ? redis.put(key, value) : fallback.put(key, value);
    },
    delete: async (key: string) => {
      const env = getEnv();
      if (env?.CHAT_DO) return new WorkerPersistentStore(env).delete(key);
      return redis ? redis.delete(key) : fallback.delete(key);
    },
  };
}
