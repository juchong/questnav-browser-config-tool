import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { ConfigProfile, ExecutionLog, AdminUser } from '../models/types';

const dbPath = process.env.DATABASE_PATH || './data/questnav.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      commands TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_logs_profile_id ON execution_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_logs_executed_at ON execution_logs(executed_at);
  `);

  // Insert default profile if none exist
  const count = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
  if (count.count === 0) {
    insertDefaultProfile();
  }

  // Initialize admin user from environment variables
  initializeAdminUser();
}

function insertDefaultProfile() {
  const defaultProfile: ConfigProfile = {
    name: 'Quest Performance Optimization',
    description: 'Optimizes Quest headset for best performance: 120Hz, high performance mode, disabled telemetry',
    commands: [
      {
        command: 'setprop debug.oculus.refreshRate 120',
        description: 'Set refresh rate to 120Hz',
        category: 'refresh_rate'
      },
      {
        command: 'setprop debug.oculus.cpuLevel 4',
        description: 'Set CPU level to maximum',
        category: 'performance'
      },
      {
        command: 'setprop debug.oculus.gpuLevel 4',
        description: 'Set GPU level to maximum',
        category: 'performance'
      },
      {
        command: 'pm disable com.oculus.unifiedtelemetry',
        description: 'Disable unified telemetry',
        category: 'privacy'
      },
      {
        command: 'pm disable com.oculus.gatekeeperservice',
        description: 'Disable gatekeeper service',
        category: 'privacy'
      },
      {
        command: 'setprop debug.oculus.foveation.level 0',
        description: 'Disable foveation for clearest image',
        category: 'display'
      },
      {
        command: 'setprop debug.oculus.guardian_pause 1',
        description: 'Pause guardian system',
        category: 'system'
      }
    ]
  };

  const stmt = db.prepare('INSERT INTO profiles (name, description, commands) VALUES (?, ?, ?)');
  stmt.run(defaultProfile.name, defaultProfile.description, JSON.stringify(defaultProfile.commands));
}

async function initializeAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn('WARNING: ADMIN_PASSWORD not set in environment variables. Admin authentication will not work.');
    return;
  }

  // Check if admin user exists
  const existingUser = db.prepare('SELECT * FROM admin_user WHERE username = ?').get(username) as AdminUser | undefined;

  // Hash the password from environment
  const passwordHash = await bcrypt.hash(password, 10);

  if (existingUser) {
    // Update password if it changed
    const passwordMatch = await bcrypt.compare(password, existingUser.password_hash);
    if (!passwordMatch) {
      console.log('Admin password changed, updating...');
      db.prepare('UPDATE admin_user SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
        .run(passwordHash, username);
    }
  } else {
    // Create new admin user
    console.log('Creating admin user...');
    db.prepare('INSERT INTO admin_user (username, password_hash) VALUES (?, ?)')
      .run(username, passwordHash);
  }
}

// Profile operations
export const profileDb = {
  getAll(): ConfigProfile[] {
    const rows = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
      ...row,
      commands: JSON.parse(row.commands)
    }));
  },

  getById(id: number): ConfigProfile | undefined {
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      commands: JSON.parse(row.commands)
    };
  },

  create(profile: ConfigProfile): ConfigProfile {
    const stmt = db.prepare('INSERT INTO profiles (name, description, commands) VALUES (?, ?, ?)');
    const result = stmt.run(profile.name, profile.description, JSON.stringify(profile.commands));
    return this.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, profile: Partial<ConfigProfile>): ConfigProfile | undefined {
    const updates: string[] = [];
    const values: any[] = [];

    if (profile.name !== undefined) {
      updates.push('name = ?');
      values.push(profile.name);
    }
    if (profile.description !== undefined) {
      updates.push('description = ?');
      values.push(profile.description);
    }
    if (profile.commands !== undefined) {
      updates.push('commands = ?');
      values.push(JSON.stringify(profile.commands));
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) return this.getById(id); // Only timestamp update

    values.push(id);
    const stmt = db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM profiles WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
};

// Execution log operations
export const logDb = {
  create(log: ExecutionLog): ExecutionLog {
    const stmt = db.prepare('INSERT INTO execution_logs (profile_id, status, error_message) VALUES (?, ?, ?)');
    const result = stmt.run(log.profile_id, log.status, log.error_message || null);
    return {
      id: result.lastInsertRowid as number,
      ...log
    };
  },

  getAll(limit: number = 100): ExecutionLog[] {
    return db.prepare('SELECT * FROM execution_logs ORDER BY executed_at DESC LIMIT ?').all(limit) as ExecutionLog[];
  },

  getByProfileId(profileId: number, limit: number = 50): ExecutionLog[] {
    return db.prepare('SELECT * FROM execution_logs WHERE profile_id = ? ORDER BY executed_at DESC LIMIT ?')
      .all(profileId, limit) as ExecutionLog[];
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM execution_logs').get() as { count: number };
    const success = db.prepare('SELECT COUNT(*) as count FROM execution_logs WHERE status = ?').get('success') as { count: number };
    const failure = db.prepare('SELECT COUNT(*) as count FROM execution_logs WHERE status = ?').get('failure') as { count: number };
    
    return {
      total: total.count,
      success: success.count,
      failure: failure.count,
      successRate: total.count > 0 ? (success.count / total.count) * 100 : 0
    };
  }
};

// Admin user operations
export const adminUserDb = {
  getByUsername(username: string): AdminUser | undefined {
    return db.prepare('SELECT * FROM admin_user WHERE username = ?').get(username) as AdminUser | undefined;
  },

  async verifyPassword(username: string, password: string): Promise<boolean> {
    const user = this.getByUsername(username);
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
  }
};

// Initialize database on module load
initializeDatabase();

export default db;

