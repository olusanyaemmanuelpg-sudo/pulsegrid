import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

const PREFIX = 'enc:v1:';
const AAD = Buffer.from('pulsegrid-monitor-target:v1');

const getKey = () => {
  const configuredKey = process.env.MONITOR_TARGET_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(configuredKey)) {
    throw new Error(
      'MONITOR_TARGET_ENCRYPTION_KEY must be set to a 64-character hex key.',
    );
  }
  return Buffer.from(configuredKey, 'hex');
};

export const assertMonitorTargetEncryptionKey = () => {
  getKey();
};

export const isEncryptedMonitorTarget = (target) =>
  typeof target === 'string' && target.startsWith(PREFIX);

export const encryptMonitorTarget = (target) => {
  if (typeof target !== 'string' || !target) {
    throw new TypeError('Monitor target must be a non-empty string.');
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(target, 'utf8'),
    cipher.final(),
  ]);

  return [
    PREFIX.slice(0, -1),
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
};

export const decryptMonitorTarget = (encryptedTarget) => {
  if (!isEncryptedMonitorTarget(encryptedTarget)) {
    throw new Error('Monitor target is not encrypted.');
  }

  const [, format, version, ivText, tagText, ciphertextText] =
    encryptedTarget.match(/^(enc):(v1):([^:]+):([^:]+):([^:]+)$/) || [];
  if (
    format !== 'enc' ||
    version !== 'v1' ||
    !ivText ||
    !tagText ||
    !ciphertextText
  ) {
    throw new Error('Monitor target ciphertext has an invalid format.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const fingerprintMonitorTarget = (target) => {
  const fingerprintKey = createHmac('sha256', getKey())
    .update('pulsegrid-monitor-target-fingerprint:v1')
    .digest();
  return createHmac('sha256', fingerprintKey)
    .update(target.trim())
    .digest('hex');
};

export const getMonitorTargetPreview = (target, type) => {
  try {
    const url = new URL(target);
    const host = url.hostname;
    const port = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${host}${port}/[redacted]`;
  } catch {
    return `${type}://[redacted]`;
  }
};
