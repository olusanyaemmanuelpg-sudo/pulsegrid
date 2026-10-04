import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const handleLogin = async (req, res) => {
  const { email, password } = req.body ?? {};
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      message: 'Email and password are required',
    });
  }
  if (!process.env.JWT_SECRET) {
    return res
      .status(500)
      .json({ message: 'Authentication is not configured' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { rows } = await query(
      `SELECT id, name, email, password_hash, role, created_at 
    FROM users 
    WHERE email = $1`,
      [normalizedEmail],
    );
    if (rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email and password',
      });
    }
    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(401).json({
        message: 'Invalid email and password',
      });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    delete user.password_hash;

    return res.status(200).json({
      user,
      token,
    });
  } catch (err) {
    console.error('Login error', err.message);
    return res.status(500).json({
      message: 'Unable to login at this time',
    });
  }
};
