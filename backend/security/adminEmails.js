const DEFAULT_ADMIN_EMAILS =
  process.env.NODE_ENV === 'production' ? '' : 'olusanyaemmanuelpg@gmail.com';

export const getAdminEmails = (
  configuredEmails = process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS,
) =>
  (configuredEmails || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email, configuredEmails) => {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return false;

  return getAdminEmails(configuredEmails).includes(normalizedEmail);
};
