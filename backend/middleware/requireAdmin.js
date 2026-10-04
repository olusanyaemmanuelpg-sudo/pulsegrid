import { readQuery } from '../config/db.js';

/**
 * Role-Based Access Control (RBAC) middleware.
 * Verifies that the authenticated user possesses the 'admin' role.
 * Queries PostgreSQL directly so role updates (promotions/demotions) take effect immediately.
 */
export const requireAdmin = async (req, res, next, queryFn = readQuery) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      message: 'Access denied: Authentication required.',
    });
  }

  try {
    const { rows } = await queryFn(
      'SELECT id, email, role FROM users WHERE id = $1',
      [req.user.id],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Access denied: User account not found.',
      });
    }

    const user = rows[0];

    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied: Administrator privileges required.',
      });
    }

    // Attach verified role to request
    req.user.role = user.role;
    return next();
  } catch (err) {
    console.error('❌ [requireAdmin] Authorization error:', err.message);
    return res.status(500).json({
      message: 'Failed to verify administrative authorization.',
    });
  }
};

export default requireAdmin;
