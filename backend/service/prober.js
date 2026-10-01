import Redis from 'ioredis';

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

  try {
    const start = performance.now();
    client = new Redis(target, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
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
    return {
      status: 'down',
      latency: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    client?.disconnect();
  }
};
