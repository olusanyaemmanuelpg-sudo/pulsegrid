import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import * as db from '../config/db.js';
import * as bcryptMod from 'bcryptjs';
import * as jwtMod from 'jsonwebtoken';
import { handleRegister } from '../controller/registerController.js';

test('handleRegister stores the user with matching column/value counts', async () => {
  mock.method(db, 'query', async (sql, params) => {
    if (sql.includes('SELECT * FROM users WHERE email = $1')) {
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO users')) {
      assert.match(
        sql,
        /INSERT INTO users \(name, email, password_hash, role\)/,
      );
      assert.deepEqual(params, ['Jane', 'jane@example.com', 'hashed-password', 'developer']);
      return {
        rows: [{ id: 1, name: 'Jane', email: 'jane@example.com', role: 'developer', created_at: new Date() }],
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });

  mock.method(bcryptMod, 'hash', async () => 'hashed-password');
  mock.method(jwtMod, 'sign', () => 'test-token');

  const req = {
    body: {
      name: 'Jane',
      email: 'JANE@example.com',
      password: 'supersecret',
    },
  };

  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };

  await handleRegister(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.token, 'test-token');
  assert.equal(res.payload.user.role, 'developer');
});
