import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const handleRegister = async (req, res) => {
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
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [
      normalizedEmail,
    ]);
    if (rows.length > 0) {
      return res.status(409).json({
        message: 'Email is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: insertedRows } = await query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, normalizedEmail, hashedPassword],
    );
    const user = insertedRows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email },
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
