import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Database from '../db/index.js';
import { logger } from '../logger.js';

function sessionExpirySqlValue() {
  // Postgres-friendly timestamp without trailing Z
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

export class AuthService {
  constructor() {
    this.db = Database.getInstance();
  }

  async authenticate(username, password) {
    const user = await this.db.get(
      `
      SELECT * FROM users 
      WHERE username = ? AND COALESCE(is_active, 1) = 1
    `,
      [username]
    );

    // Generic error — do not reveal which field failed
    const fail = { success: false, error: 'Invalid username or password' };

    if (!user || !user.password_hash || !password || typeof password !== 'string') {
      return fail;
    }

    let isValidPassword = false;
    try {
      isValidPassword = bcrypt.compareSync(password, user.password_hash);
    } catch {
      return fail;
    }

    if (!isValidPassword) {
      return fail;
    }

    // Generate a self-healing stateless session token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      created: Date.now(),
    };
    const sessionToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    const expiresAt = sessionExpirySqlValue();

    try {
      await this.db.run(
        `
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `,
        [user.id, sessionToken, expiresAt]
      );
    } catch (err) {
      logger.error('session_insert_failed', { message: err?.message, code: err?.code });
      const e = new Error('Could not create session. Please try again.');
      e.status = 500;
      e.cause = err;
      throw e;
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        must_change_password: !!user.must_change_password,
      },
      token: sessionToken,
    };
  }

  async verifySession(token) {
    if (!token) return null;

    // 1. Try verifying via database sessions table
    let session = await this.db.get(
      `
      SELECT s.*, u.id as user_id, u.username, u.full_name, u.role, u.email, u.phone,
             u.is_active, u.must_change_password
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
    `,
      [token]
    );

    if (session && session.is_active) {
      return {
        id: session.user_id,
        username: session.username,
        full_name: session.full_name,
        role: session.role,
        email: session.email,
        phone: session.phone,
        must_change_password: !!session.must_change_password,
      };
    }

    // 2. Session not found in DB. Try stateless session healing (useful for Vercel ephemeral DB recycles)
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      if (decoded && decoded.username) {
        const user = await this.db.get(
          'SELECT * FROM users WHERE username = ? AND COALESCE(is_active, 1) = 1',
          [decoded.username]
        );
        if (user) {
          const expiresAt = sessionExpirySqlValue();
          // Insert the missing session back into the newly created database instance
          if (this.db.driver === 'postgres') {
            await this.db.run(
              `
              INSERT INTO sessions (user_id, token, expires_at)
              VALUES (?, ?, ?)
              ON CONFLICT DO NOTHING
            `,
              [user.id, token, expiresAt]
            );
          } else {
            await this.db.run(
              `
              INSERT OR IGNORE INTO sessions (user_id, token, expires_at)
              VALUES (?, ?, ?)
            `,
              [user.id, token, expiresAt]
            );
          }
          logger.info('session_restored_via_self_healing', { username: user.username });
          return {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            email: user.email,
            phone: user.phone,
            must_change_password: !!user.must_change_password,
          };
        }
      }
    } catch (err) {
      // Decode or parse failed, ignore
    }

    return null;
  }

  async logout(token) {
    if (!token) return;
    return this.db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
  }

  async logoutAllForUser(userId) {
    return this.db.run(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
  }

  hasPermission(userRole, permission) {
    const permissions = {
      admin: ['*'],
      cashier: ['bills.*', 'orders.view', 'payments.*', 'tables.view'],
      waiter: ['orders.*', 'tables.*', 'menu.view'],
      kitchen: ['kots.*', 'orders.view', 'orders.update'],
    };

    const userPermissions = permissions[userRole] || [];
    if (userPermissions.includes('*')) return true;

    return userPermissions.some((p) => {
      if (p.endsWith('.*')) {
        return permission.startsWith(p.slice(0, -2));
      }
      return p === permission;
    });
  }

  async registerDevice(deviceId, userId, deviceType, ipAddress) {
    try {
      if (this.db.driver === 'postgres') {
        return await this.db.run(
          `
          INSERT INTO devices (device_id, user_id, device_type, ip_address, last_seen)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (device_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            device_type = EXCLUDED.device_type,
            ip_address = EXCLUDED.ip_address,
            last_seen = CURRENT_TIMESTAMP
        `,
          [deviceId, userId, deviceType, ipAddress]
        );
      }
      return await this.db.run(
        `
        INSERT OR REPLACE INTO devices (device_id, user_id, device_type, ip_address, last_seen)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
        [deviceId, userId, deviceType, ipAddress]
      );
    } catch (error) {
      logger.warn('register_device_failed', { message: error.message });
      throw error;
    }
  }

  async getActiveDevices() {
    return this.db.all(`
      SELECT d.*, u.full_name as user_name, u.role
      FROM devices d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.is_active = 1
      ORDER BY d.last_seen DESC
    `);
  }
}
