import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { isAdminEmail } from '../security/adminEmails.js';

export const handleRegister = async (
  req,
  res,
  queryFn = query,
  hashFn = bcrypt.hash,
  signFn = jwt.sign,
) => {
  const actualQuery =
    typeof queryFn === 'function' && queryFn.name !== 'next' ? queryFn : query;
  const actualHash = typeof hashFn === 'function' ? hashFn : bcrypt.hash;
  const actualSign = typeof signFn === 'function' ? signFn : jwt.sign;

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: 'Your name, email, and password are required',
    });
  }
  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters',
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { rows } = await actualQuery('SELECT * FROM users WHERE email = $1', [
      normalizedEmail,
    ]);
    if (rows.length > 0) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await actualHash(password, 10);
    const role = isAdminEmail(normalizedEmail) ? 'admin' : 'developer';
    const { rows: insertedRows } = await actualQuery(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, normalizedEmail, hashedPassword, role],
    );
    const user = insertedRows[0];
    const token = actualSign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    console.error('Registration failed:', err.message);
    return res.status(500).json({ message: 'Unable to register user' });
  }
};
