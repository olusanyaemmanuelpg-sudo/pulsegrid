const DEFAULT_ADMIN_EMAILS = 'olusanyaemmanuelpg@gmail.com';

export const getAdminEmails = (configuredEmails = process.env.ADMIN_EMAILS) =>
  (configuredEmails || DEFAULT_ADMIN_EMAILS)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email, configuredEmails) =>
  getAdminEmails(configuredEmails).includes(email.trim().toLowerCase());