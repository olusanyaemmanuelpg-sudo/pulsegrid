import jwt from 'jsonwebtoken';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || String(secret).trim().length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  }

  return secret;
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      message: 'Access denied: A Bearer token is required.',
    });
  }

  try {
    const jwtSecret = getJwtSecret();
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('JWT_SECRET')
        ? 'Authentication is not configured.'
        : 'Access denied: Invalid or expired token.';

    res
      .status(
        error instanceof Error && error.message.includes('JWT_SECRET')
          ? 500
          : 401,
      )
      .json({
        message,
      });
    return;
  }
};

export default requireAuth;
