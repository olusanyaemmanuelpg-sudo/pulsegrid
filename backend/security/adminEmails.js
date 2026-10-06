const getDefaultAdminEmails = () =>
  process.env.NODE_ENV === 'production' ? '' : 'olusanyaemmanuelpg@gmail.com';

export const getAdminEmails = (configuredEmails) => {
  const source =
    configuredEmails !== undefined && configuredEmails !== ''
      ? configuredEmails
      : (process.env.ADMIN_EMAILS || getDefaultAdminEmails());

  return (source || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
};

export const isAdminEmail = (email, configuredEmails) => {
  const normalizedEmail = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!normalizedEmail) return false;

  return getAdminEmails(configuredEmails).includes(normalizedEmail);
};
