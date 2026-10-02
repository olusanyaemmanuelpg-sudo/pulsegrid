import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

const allowedProtocols = {
  http: new Set(['http:', 'https:']),
  mysql: new Set(['http:', 'https:']),
  postgres: new Set(['postgres:', 'postgresql:']),
  redis: new Set(['rediss:']),
  cron: new Set(['https:']),
};

export class TargetValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TargetValidationError';
  }
}

const normalizeHostname = (hostname) =>
  hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();

const isPublicAddress = (address) => {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
};

export const resolvePublicMonitorTarget = async (
  type,
  target,
  lookupHost = dnsLookup,
) => {
  const protocols = allowedProtocols[type];
  if (!protocols || typeof target !== 'string') {
    throw new TargetValidationError('Unsupported monitor target type.');
  }

  let url;
  try {
    url = new URL(target);
  } catch {
    throw new TargetValidationError('Target must be a valid connection URL.');
  }

  if (!protocols.has(url.protocol) || !url.hostname) {
    throw new TargetValidationError(
      'Target URL scheme is not allowed for this monitor type.',
    );
  }

  if ((type === 'http' || type === 'mysql') && (url.username || url.password)) {
    throw new TargetValidationError(
      'HTTP monitor URLs must not contain embedded credentials.',
    );
  }

  const hostname = normalizeHostname(url.hostname);
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    (!isIP(hostname) && !hostname.includes('.'))
  ) {
    throw new TargetValidationError(
      'Private and local monitor destinations are not allowed.',
    );
  }

  if (type === 'cron') return { url, hostname, addresses: [] };

  let addresses;
  if (isIP(hostname)) {
    addresses = [{ address: hostname, family: isIP(hostname) }];
  } else {
    try {
      addresses = await lookupHost(hostname, { all: true, verbatim: true });
    } catch {
      throw new TargetValidationError(
        'Monitor target hostname could not be resolved.',
      );
    }
  }

  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new TargetValidationError(
      'Private and local monitor destinations are not allowed.',
    );
  }

  return { url, hostname, addresses };
};

export const validateMonitorTarget = async (type, target) => {
  await resolvePublicMonitorTarget(type, target);
};

export const createPinnedLookup =
  (addresses) => (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const records = addresses.map(({ address, family }) => ({
      address,
      family: family || isIP(address),
    }));

    if (options?.all) {
      callback(null, records);
      return;
    }

    callback(null, records[0].address, records[0].family);
  };
