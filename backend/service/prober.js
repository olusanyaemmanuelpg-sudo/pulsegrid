import Redis from 'ioredis';
import { Client } from 'pg';

export const proberHttp = async (target, keyword = null) => {
  try {
    const startTime = performance.now();
    const response = await fetch(target, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'PulseGrid-Uptime-Bot/1.0' },
    });

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Unexpected HTTP status: ${response.status}`);
    }

    if (keyword) {
      const body = await response.text();
      if (!body.includes(keyword)) {
        throw new Error('Keyword assertion failed');
      }
    }

    return {
      status: 'up',
      latency: Math.round(performance.now() - startTime),
      error: null,
    };
  } catch (err) {
    return {
      status: 'down',
      latency: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export const probeRedis = async (target) => {
  let client;
  let clientError;

  try {
    const start = performance.now();
    client = new Redis(target, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    client.on('error', (error) => {
      clientError = error;
    });

    await client.connect();
    const response = await client.ping();

    if (response !== 'PONG') {
      throw new Error(`Unexpected Redis response: ${response}`);
    }

    return {
      status: 'up',
      latency: Math.round(performance.now() - start),
      error: null,
    };
  } catch (error) {
    const probeError = clientError ?? error;
    return {
      status: 'down',
      latency: 0,
      error:
        probeError instanceof Error ? probeError.message : String(probeError),
    };
  } finally {
    client?.disconnect();
  }
};

export const probePostgres = async (target) => {
  let client;

  try {
    const start = performance.now();
    client = new Client({
      connectionString: target,
      connectionTimeoutMillis: 3000,
      query_timeout: 3000,
    });

    await client.connect();
    await client.query('SELECT 1');

    return {
      status: 'up',
      latency: Math.round(performance.now() - start),
      error: null,
    };
  } catch (error) {
    return {
      status: 'down',
      latency: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    client?.end();
  }
};
