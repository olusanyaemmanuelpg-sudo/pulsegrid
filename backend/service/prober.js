import { request as httpRequest } from 'node:http';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import Redis from 'ioredis';
import { Client } from 'pg';
import {
  createPinnedLookup,
  resolvePublicMonitorTarget,
} from '../security/targetValidation.js';

const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 5000;

export const sanitizeProbeError = (error, target = '') => {
  const message = error instanceof Error ? error.message : String(error);
  const withoutTarget = target
    ? message.replaceAll(target, '[redacted target]')
    : message;
  return withoutTarget.replace(
    /(?:postgres(?:ql)?|rediss?|redis|https?):\/\/[^\s"'<>]+/gi,
    '[redacted connection]',
  );
};

const requestPublicHttp = (resolvedTarget, keyword) =>
  new Promise((resolve, reject) => {
    const { url, addresses } = resolvedTarget;
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        headers: { 'User-Agent': 'PulseGrid-Uptime-Bot/1.0' },
        lookup: createPinnedLookup(addresses),
        agent: false,
      },
      (response) => {
        let bytes = 0;
        const chunks = [];
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            request.destroy(new Error('Probe response exceeded size limit.'));
            return;
          }
          if (keyword) chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          resolve({
            status: response.statusCode || 0,
            body: keyword ? Buffer.concat(chunks).toString('utf8') : '',
          });
        });
      },
    );

    const timeout = setTimeout(
      () => request.destroy(new Error('Probe timed out.')),
      REQUEST_TIMEOUT_MS,
    );
    request.on('close', () => clearTimeout(timeout));
    request.on('error', reject);
    request.end();
  });

export const proberHttp = async (target, keyword = null) => {
  try {
    const startTime = performance.now();
    const resolvedTarget = await resolvePublicMonitorTarget('http', target);
    const response = await requestPublicHttp(resolvedTarget, keyword);

    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Unexpected HTTP status: ${response.status}`);
    }

    if (keyword && !response.body.includes(keyword)) {
      throw new Error('Keyword assertion failed.');
    }

    return {
      status: 'up',
      latency: Math.round(performance.now() - startTime),
      error: null,
    };
  } catch (error) {
    return {
      status: 'down',
      latency: 0,
      error: sanitizeProbeError(error, target),
    };
  }
};

export const probeRedis = async (target) => {
  let client;
  let clientError;

  try {
    const start = performance.now();
    const resolvedTarget = await resolvePublicMonitorTarget('redis', target);
    const { url, hostname, addresses } = resolvedTarget;
    const address = addresses[0].address;
    const tlsOptions = isIP(hostname)
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: true, servername: hostname };

    client = new Redis({
      host: address,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: tlsOptions,
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
      error: sanitizeProbeError(probeError, target),
    };
  } finally {
    client?.disconnect();
  }
};

export const probePostgres = async (target) => {
  let client;

  try {
    const start = performance.now();
    const resolvedTarget = await resolvePublicMonitorTarget('postgres', target);
    const { url, hostname, addresses } = resolvedTarget;
    const address = addresses[0].address;

    client = new Client({
      host: address,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\//, '')),
      ssl: isIP(hostname)
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: true, servername: hostname },
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
      error: sanitizeProbeError(error, target),
    };
  } finally {
    await client?.end().catch(() => {});
  }
};
