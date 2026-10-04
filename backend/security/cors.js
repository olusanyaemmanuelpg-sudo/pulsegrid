export const getAllowedOrigins = () => {
  const fallbackOrigins =
    process.env.NODE_ENV === 'production'
      ? ''
      : 'http://localhost:5173,http://localhost:3000';

  const rawOrigins = (process.env.CORS_ORIGIN || fallbackOrigins)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return rawOrigins.map((origin) => origin.replace(/\/+$/, ''));
};

export const isOriginAllowed = (origin) => {
  const allowedOrigins = getAllowedOrigins();

  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;

  return allowedOrigins.includes(origin.replace(/\/+$/, ''));
};

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
