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
      is_active INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS apk_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      release_tag TEXT NOT NULL UNIQUE,
      release_name TEXT NOT NULL,
      apk_name TEXT NOT NULL,
      apk_url TEXT NOT NULL,
      apk_hash TEXT,
      apk_size INTEGER,
      download_status TEXT DEFAULT 'pending',
      download_error TEXT,
      published_at DATETIME,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      downloaded_at DATETIME,
      source TEXT DEFAULT 'webhook'
    );

    CREATE INDEX IF NOT EXISTS idx_logs_profile_id ON execution_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_logs_executed_at ON execution_logs(executed_at);
    CREATE INDEX IF NOT EXISTS idx_releases_tag ON apk_releases(release_tag);
    CREATE INDEX IF NOT EXISTS idx_releases_status ON apk_releases(download_status);

    CREATE TABLE IF NOT EXISTS ignored_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial TEXT NOT NULL UNIQUE,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_ignored_serials ON ignored_serials(serial);
  `);

  // Migrate existing database: add is_active column if it doesn't exist
  try {
    const tableInfo = db.prepare("PRAGMA table_info(profiles)").all() as any[];
    const hasIsActive = tableInfo.some(col => col.name === 'is_active');
    
    if (!hasIsActive) {
      console.log('Migrating database: adding is_active column to profiles table...');
      db.exec('ALTER TABLE profiles ADD COLUMN is_active INTEGER DEFAULT 0');
      
      // Set the first profile as active if any exist
      const firstProfile = db.prepare('SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1').get() as { id: number } | undefined;
      if (firstProfile) {
        db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?').run(firstProfile.id);
        console.log(`Set profile ID ${firstProfile.id} as active`);
      }
    }
  } catch (error) {
    console.error('Error during database migration:', error);
  }

  // Migrate execution_logs table: add enhanced logging columns if they don't exist
  try {
    const logsTableInfo = db.prepare("PRAGMA table_info(execution_logs)").all() as any[];
    const existingColumns = new Set(logsTableInfo.map((col: any) => col.name));
    
    const newColumns = [
      { name: 'client_ip', type: 'TEXT' },
      { name: 'user_agent', type: 'TEXT' },
      { name: 'device_serial', type: 'TEXT' },
      { name: 'device_name', type: 'TEXT' },
      { name: 'connection_timestamp', type: 'DATETIME' },
      { name: 'execution_start_timestamp', type: 'DATETIME' },
      { name: 'execution_end_timestamp', type: 'DATETIME' },
      { name: 'execution_duration_ms', type: 'INTEGER' },
      { name: 'command_results', type: 'TEXT' }, // JSON storage
      { name: 'total_commands', type: 'INTEGER' },
      { name: 'successful_commands', type: 'INTEGER' },
      { name: 'failed_commands', type: 'INTEGER' },
      // Browser information
      { name: 'browser_name', type: 'TEXT' },
      { name: 'browser_version', type: 'TEXT' },
      { name: 'browser_engine', type: 'TEXT' },
      { name: 'os_name', type: 'TEXT' },
      { name: 'os_version', type: 'TEXT' },
      { name: 'platform', type: 'TEXT' },
      { name: 'screen_resolution', type: 'TEXT' },
      { name: 'viewport_size', type: 'TEXT' },
      { name: 'timezone', type: 'TEXT' },
      { name: 'language', type: 'TEXT' },
      { name: 'webusb_supported', type: 'INTEGER' },
      { name: 'browser_fingerprint', type: 'TEXT' },
      // QuestNav installation tracking
      { name: 'questnav_installed', type: 'INTEGER' },
      { name: 'questnav_version', type: 'TEXT' }
    ];

    let migrationNeeded = false;
    for (const col of newColumns) {
      if (!existingColumns.has(col.name)) {
        migrationNeeded = true;
        break;
      }
    }

    if (migrationNeeded) {
      console.log('Migrating execution_logs table: adding enhanced logging columns...');
      for (const col of newColumns) {
        if (!existingColumns.has(col.name)) {
          const sql = `ALTER TABLE execution_logs ADD COLUMN ${col.name} ${col.type}`;
          console.log(`  - Adding column: ${col.name}`);
          db.exec(sql);
        }
      }
      console.log('Enhanced logging columns added successfully');
    }
  } catch (error) {
    console.error('Error during execution_logs migration:', error);
  }

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

  // Insert as active profile (is_active = 1) since it's the first one
  const stmt = db.prepare('INSERT INTO profiles (name, description, commands, is_active) VALUES (?, ?, ?, ?)');
  stmt.run(defaultProfile.name, defaultProfile.description, JSON.stringify(defaultProfile.commands), 1);
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
      commands: JSON.parse(row.commands),
      is_active: Boolean(row.is_active)
    }));
  },

  // Get visible profiles with only visible commands (for users)
  getVisible(): ConfigProfile[] {
    const rows = db.prepare('SELECT * FROM profiles ORDER BY created_at DESC').all() as any[];
    // Return all commands - filtering for display happens in frontend
    return rows.map(row => ({
      ...row,
      commands: JSON.parse(row.commands),
      is_active: Boolean(row.is_active)
    }));
  },

  getActive(): ConfigProfile | undefined {
    const row = db.prepare('SELECT * FROM profiles WHERE is_active = 1 LIMIT 1').get() as any;
    if (!row) return undefined;
    // Return all commands - filtering for display happens in frontend
    return {
      ...row,
      commands: JSON.parse(row.commands),
      is_active: true
    };
  },

  getById(id: number): ConfigProfile | undefined {
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      commands: JSON.parse(row.commands),
      is_active: Boolean(row.is_active)
    };
  },

  create(profile: ConfigProfile): ConfigProfile {
    const stmt = db.prepare('INSERT INTO profiles (name, description, commands, is_active) VALUES (?, ?, ?, ?)');
    const result = stmt.run(
      profile.name, 
      profile.description, 
      JSON.stringify(profile.commands), 
      0
    );
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

  setActive(id: number): boolean {
    // First, deactivate all profiles
    db.prepare('UPDATE profiles SET is_active = 0').run();
    
    // Then activate the specified profile
    const stmt = db.prepare('UPDATE profiles SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  delete(id: number): boolean {
    // Check if this is the active profile
    const profile = this.getById(id);
    const wasActive = profile?.is_active;
    
    const stmt = db.prepare('DELETE FROM profiles WHERE id = ?');
    const result = stmt.run(id);
    
    // If we deleted the active profile, set another one as active
    if (wasActive && result.changes > 0) {
      const firstProfile = db.prepare('SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1').get() as { id: number } | undefined;
      if (firstProfile) {
        this.setActive(firstProfile.id);
      }
    }
    
    return result.changes > 0;
  }
};

// Execution log operations
export const logDb = {
  create(log: ExecutionLog): ExecutionLog {
    // Build dynamic SQL based on provided fields
    const fields: string[] = ['profile_id', 'status'];
    const placeholders: string[] = ['?', '?'];
    const values: any[] = [log.profile_id, log.status];

    // Add optional fields if provided
    if (log.error_message !== undefined) {
      fields.push('error_message');
      placeholders.push('?');
      values.push(log.error_message);
    }
    if (log.client_ip !== undefined) {
      fields.push('client_ip');
      placeholders.push('?');
      values.push(log.client_ip);
    }
    if (log.user_agent !== undefined) {
      fields.push('user_agent');
      placeholders.push('?');
      values.push(log.user_agent);
    }
    if (log.device_serial !== undefined) {
      fields.push('device_serial');
      placeholders.push('?');
      values.push(log.device_serial);
    }
    if (log.device_name !== undefined) {
      fields.push('device_name');
      placeholders.push('?');
      values.push(log.device_name);
    }
    if (log.connection_timestamp !== undefined) {
      fields.push('connection_timestamp');
      placeholders.push('?');
      values.push(log.connection_timestamp);
    }
    if (log.execution_start_timestamp !== undefined) {
      fields.push('execution_start_timestamp');
      placeholders.push('?');
      values.push(log.execution_start_timestamp);
    }
    if (log.execution_end_timestamp !== undefined) {
      fields.push('execution_end_timestamp');
      placeholders.push('?');
      values.push(log.execution_end_timestamp);
    }
    if (log.execution_duration_ms !== undefined) {
      fields.push('execution_duration_ms');
      placeholders.push('?');
      values.push(log.execution_duration_ms);
    }
    if (log.command_results !== undefined) {
      fields.push('command_results');
      placeholders.push('?');
      values.push(JSON.stringify(log.command_results));
    }
    if (log.total_commands !== undefined) {
      fields.push('total_commands');
      placeholders.push('?');
      values.push(log.total_commands);
    }
    if (log.successful_commands !== undefined) {
      fields.push('successful_commands');
      placeholders.push('?');
      values.push(log.successful_commands);
    }
    if (log.failed_commands !== undefined) {
      fields.push('failed_commands');
      placeholders.push('?');
      values.push(log.failed_commands);
    }
    // Browser information fields
    if (log.browser_name !== undefined) {
      fields.push('browser_name');
      placeholders.push('?');
      values.push(log.browser_name);
    }
    if (log.browser_version !== undefined) {
      fields.push('browser_version');
      placeholders.push('?');
      values.push(log.browser_version);
    }
    if (log.browser_engine !== undefined) {
      fields.push('browser_engine');
      placeholders.push('?');
      values.push(log.browser_engine);
    }
    if (log.os_name !== undefined) {
      fields.push('os_name');
      placeholders.push('?');
      values.push(log.os_name);
    }
    if (log.os_version !== undefined) {
      fields.push('os_version');
      placeholders.push('?');
      values.push(log.os_version);
    }
    if (log.platform !== undefined) {
      fields.push('platform');
      placeholders.push('?');
      values.push(log.platform);
    }
    if (log.screen_resolution !== undefined) {
      fields.push('screen_resolution');
      placeholders.push('?');
      values.push(log.screen_resolution);
    }
    if (log.viewport_size !== undefined) {
      fields.push('viewport_size');
      placeholders.push('?');
      values.push(log.viewport_size);
    }
    if (log.timezone !== undefined) {
      fields.push('timezone');
      placeholders.push('?');
      values.push(log.timezone);
    }
    if (log.language !== undefined) {
      fields.push('language');
      placeholders.push('?');
      values.push(log.language);
    }
    if (log.webusb_supported !== undefined) {
      fields.push('webusb_supported');
      placeholders.push('?');
      values.push(log.webusb_supported ? 1 : 0);
    }
    if (log.browser_fingerprint !== undefined) {
      fields.push('browser_fingerprint');
      placeholders.push('?');
      values.push(log.browser_fingerprint);
    }
    // QuestNav installation tracking
    if (log.questnav_installed !== undefined) {
      fields.push('questnav_installed');
      placeholders.push('?');
      values.push(log.questnav_installed ? 1 : 0);
    }
    if (log.questnav_version !== undefined) {
      fields.push('questnav_version');
      placeholders.push('?');
      values.push(log.questnav_version);
    }

    const sql = `INSERT INTO execution_logs (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const stmt = db.prepare(sql);
    const result = stmt.run(...values);
    
    return this.getById(result.lastInsertRowid as number)!;
  },

  getById(id: number): ExecutionLog | undefined {
    const row = db.prepare('SELECT * FROM execution_logs WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    
    // Parse command_results JSON if present
    if (row.command_results) {
      try {
        row.command_results = JSON.parse(row.command_results);
      } catch (e) {
        console.error('Failed to parse command_results JSON:', e);
        row.command_results = null;
      }
    }
    
    return row;
  },

  getAll(limit: number = 100): ExecutionLog[] {
    const rows = db.prepare('SELECT * FROM execution_logs ORDER BY executed_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => {
      // Parse command_results JSON if present
      if (row.command_results) {
        try {
          row.command_results = JSON.parse(row.command_results);
        } catch (e) {
          console.error('Failed to parse command_results JSON:', e);
          row.command_results = null;
        }
      }
      return row;
    });
  },

  getByProfileId(profileId: number, limit: number = 50): ExecutionLog[] {
    const rows = db.prepare('SELECT * FROM execution_logs WHERE profile_id = ? ORDER BY executed_at DESC LIMIT ?')
      .all(profileId, limit) as any[];
    return rows.map(row => {
      // Parse command_results JSON if present
      if (row.command_results) {
        try {
          row.command_results = JSON.parse(row.command_results);
        } catch (e) {
          console.error('Failed to parse command_results JSON:', e);
          row.command_results = null;
        }
      }
      return row;
    });
  },

  getByDeviceSerial(deviceSerial: string, limit: number = 50): ExecutionLog[] {
    const rows = db.prepare('SELECT * FROM execution_logs WHERE device_serial = ? ORDER BY executed_at DESC LIMIT ?')
      .all(deviceSerial, limit) as any[];
    return rows.map(row => {
      // Parse command_results JSON if present
      if (row.command_results) {
        try {
          row.command_results = JSON.parse(row.command_results);
        } catch (e) {
          console.error('Failed to parse command_results JSON:', e);
          row.command_results = null;
        }
      }
      return row;
    });
  },

  getUniqueDevices(): Array<{ device_serial: string; device_name: string; last_connection: string; execution_count: number }> {
    const sql = `
      SELECT 
        device_serial,
        device_name,
        MAX(executed_at) as last_connection,
        COUNT(*) as execution_count
      FROM execution_logs
      WHERE device_serial IS NOT NULL
      GROUP BY device_serial
      ORDER BY last_connection DESC
    `;
    return db.prepare(sql).all() as any[];
  },

  getStats() {
    // Exclude ignored serials from stats
    const excludeClause = `
      AND (device_serial IS NULL OR device_serial NOT IN (SELECT serial FROM ignored_serials))
    `;
    const total = db.prepare(`SELECT COUNT(*) as count FROM execution_logs WHERE 1=1 ${excludeClause}`).get() as { count: number };
    const success = db.prepare(`SELECT COUNT(*) as count FROM execution_logs WHERE status = ? ${excludeClause}`).get('success') as { count: number };
    const failure = db.prepare(`SELECT COUNT(*) as count FROM execution_logs WHERE status = ? ${excludeClause}`).get('failure') as { count: number };
    
    return {
      total: total.count,
      success: success.count,
      failure: failure.count,
      successRate: total.count > 0 ? (success.count / total.count) * 100 : 0
    };
  },

  getExtendedStats(days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString();

    // Subquery to get ignored serials
    const excludeClause = `AND (device_serial IS NULL OR device_serial NOT IN (SELECT serial FROM ignored_serials))`;

    // Basic counts for the period
    const periodStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial
      FROM execution_logs 
      WHERE executed_at >= ? ${excludeClause}
    `).get(cutoffStr) as { total: number; success: number; failure: number; partial: number };

    // Daily breakdown
    const dailyStats = db.prepare(`
      SELECT 
        DATE(executed_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure
      FROM execution_logs 
      WHERE executed_at >= ? ${excludeClause}
      GROUP BY DATE(executed_at)
      ORDER BY date ASC
    `).all(cutoffStr) as Array<{ date: string; total: number; success: number; failure: number }>;

    // Browser breakdown
    const browserStats = db.prepare(`
      SELECT 
        COALESCE(browser_name, 'Unknown') as browser,
        COUNT(*) as count
      FROM execution_logs 
      WHERE executed_at >= ? ${excludeClause}
      GROUP BY browser_name
      ORDER BY count DESC
      LIMIT 10
    `).all(cutoffStr) as Array<{ browser: string; count: number }>;

    // OS breakdown
    const osStats = db.prepare(`
      SELECT 
        COALESCE(os_name, 'Unknown') as os,
        COUNT(*) as count
      FROM execution_logs 
      WHERE executed_at >= ? ${excludeClause}
      GROUP BY os_name
      ORDER BY count DESC
      LIMIT 10
    `).all(cutoffStr) as Array<{ os: string; count: number }>;

    // Unique devices count (exclude ignored serials from count)
    const deviceStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT device_serial) as unique_devices
      FROM execution_logs 
      WHERE executed_at >= ? AND device_serial IS NOT NULL 
        AND device_serial NOT IN (SELECT serial FROM ignored_serials)
    `).get(cutoffStr) as { unique_devices: number };

    // Execution duration stats
    const durationStats = db.prepare(`
      SELECT 
        AVG(execution_duration_ms) as avg_duration,
        MIN(execution_duration_ms) as min_duration,
        MAX(execution_duration_ms) as max_duration
      FROM execution_logs 
      WHERE executed_at >= ? AND execution_duration_ms IS NOT NULL ${excludeClause}
    `).get(cutoffStr) as { avg_duration: number | null; min_duration: number | null; max_duration: number | null };

    // Recent executions (exclude ignored serials)
    const recentExecutionsRaw = db.prepare(`
      SELECT 
        id,
        status,
        device_name,
        device_serial,
        browser_name,
        os_name,
        executed_at,
        execution_duration_ms,
        total_commands,
        successful_commands,
        failed_commands,
        command_results,
        questnav_installed,
        questnav_version,
        client_ip
      FROM execution_logs 
      WHERE 1=1 ${excludeClause}
      ORDER BY executed_at DESC
      LIMIT 10
    `).all() as Array<{
      id: number;
      status: string;
      device_name: string | null;
      device_serial: string | null;
      browser_name: string | null;
      os_name: string | null;
      executed_at: string;
      command_results: string | null;
      questnav_installed: number | null;
      questnav_version: string | null;
      execution_duration_ms: number | null;
      total_commands: number | null;
      successful_commands: number | null;
      failed_commands: number | null;
      client_ip: string | null;
    }>;

    // Process recent executions to extract failed command details and infer QuestNav status
    const recentExecutions = recentExecutionsRaw.map(exec => {
      let failedCommands: Array<{ description: string; error: string }> = [];
      let inferredQuestNavInstalled = exec.questnav_installed === 1;
      let inferredQuestNavVersion = exec.questnav_version;
      
      // Parse command_results to find failed commands and infer QuestNav installation
      if (exec.command_results) {
        try {
          const results = JSON.parse(exec.command_results);
          if (Array.isArray(results)) {
            // Extract failed commands
            failedCommands = results
              .filter((r: any) => !r.success)
              .map((r: any) => ({
                description: r.description || r.command || 'Unknown command',
                error: r.error || 'Unknown error'
              }));
            
            // Infer QuestNav installation from command_results if not explicitly set
            // (for historical data before we added the questnav_installed field)
            if (exec.questnav_installed === null) {
              const appInstallCmd = results.find((r: any) => 
                r.category === 'app_install' && r.success
              );
              if (appInstallCmd) {
                inferredQuestNavInstalled = true;
                // Try to extract version from description or command
                const versionMatch = (appInstallCmd.description || '').match(/v[\d.]+/) ||
                                    (appInstallCmd.command || '').match(/v[\d.]+/);
                if (versionMatch) {
                  inferredQuestNavVersion = versionMatch[0];
                } else {
                  inferredQuestNavVersion = 'installed';
                }
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      return {
        id: exec.id,
        status: exec.status,
        device_name: exec.device_name,
        device_serial: exec.device_serial,
        browser_name: exec.browser_name,
        os_name: exec.os_name,
        executed_at: exec.executed_at,
        execution_duration_ms: exec.execution_duration_ms,
        total_commands: exec.total_commands,
        successful_commands: exec.successful_commands,
        failed_commands: exec.failed_commands,
        questnav_installed: inferredQuestNavInstalled,
        questnav_version: inferredQuestNavVersion,
        failed_command_details: failedCommands,
        client_ip: exec.client_ip
      };
    });

    // All-time stats for comparison (excluding ignored serials)
    const allTimeStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
      FROM execution_logs
      WHERE 1=1 ${excludeClause}
    `).get() as { total: number; success: number };

    return {
      period: {
        days,
        ...periodStats,
        successRate: periodStats.total > 0 ? (periodStats.success / periodStats.total) * 100 : 0
      },
      allTime: {
        total: allTimeStats.total,
        success: allTimeStats.success,
        successRate: allTimeStats.total > 0 ? (allTimeStats.success / allTimeStats.total) * 100 : 0
      },
      daily: dailyStats,
      browsers: browserStats,
      operatingSystems: osStats,
      devices: {
        uniqueCount: deviceStats.unique_devices
      },
      duration: {
        avgMs: durationStats.avg_duration ? Math.round(durationStats.avg_duration) : null,
        minMs: durationStats.min_duration,
        maxMs: durationStats.max_duration
      },
      recentExecutions
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

// APK Release operations
export interface ApkRelease {
  id?: number;
  release_tag: string;
  release_name: string;
  apk_name: string;
  apk_url: string;
  apk_hash?: string;
  apk_size?: number;
  download_status: 'pending' | 'downloading' | 'completed' | 'failed';
  download_error?: string;
  published_at?: string;
  detected_at?: string;
  downloaded_at?: string;
  source: 'webhook' | 'manual' | 'poll';
}

export const apkReleaseDb = {
  getAll(): ApkRelease[] {
    return db.prepare('SELECT * FROM apk_releases ORDER BY published_at DESC').all() as ApkRelease[];
  },

  getById(id: number): ApkRelease | undefined {
    return db.prepare('SELECT * FROM apk_releases WHERE id = ?').get(id) as ApkRelease | undefined;
  },

  getByTag(tag: string): ApkRelease | undefined {
    return db.prepare('SELECT * FROM apk_releases WHERE release_tag = ?').get(tag) as ApkRelease | undefined;
  },

  getLatestCompleted(): ApkRelease | undefined {
    return db.prepare(`
      SELECT * FROM apk_releases 
      WHERE download_status = 'completed' 
      ORDER BY published_at DESC 
      LIMIT 1
    `).get() as ApkRelease | undefined;
  },

  create(release: Omit<ApkRelease, 'id' | 'detected_at'>): ApkRelease {
    const stmt = db.prepare(`
      INSERT INTO apk_releases (
        release_tag, release_name, apk_name, apk_url, 
        apk_hash, apk_size, download_status, download_error,
        published_at, downloaded_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      release.release_tag,
      release.release_name,
      release.apk_name,
      release.apk_url,
      release.apk_hash || null,
      release.apk_size || null,
      release.download_status,
      release.download_error || null,
      release.published_at || null,
      release.downloaded_at || null,
      release.source
    );
    
    return this.getById(result.lastInsertRowid as number)!;
  },

  update(id: number, updates: Partial<ApkRelease>): ApkRelease | undefined {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.download_status !== undefined) {
      fields.push('download_status = ?');
      values.push(updates.download_status);
    }
    if (updates.apk_hash !== undefined) {
      fields.push('apk_hash = ?');
      values.push(updates.apk_hash);
    }
    if (updates.apk_size !== undefined) {
      fields.push('apk_size = ?');
      values.push(updates.apk_size);
    }
    if (updates.download_error !== undefined) {
      fields.push('download_error = ?');
      values.push(updates.download_error);
    }
    if (updates.downloaded_at !== undefined) {
      fields.push('downloaded_at = ?');
      values.push(updates.downloaded_at);
    }

    if (fields.length === 0) return this.getById(id);

    values.push(id);
    const stmt = db.prepare(`UPDATE apk_releases SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return this.getById(id);
  },

  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM apk_releases WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  exists(tag: string): boolean {
    const result = db.prepare('SELECT COUNT(*) as count FROM apk_releases WHERE release_tag = ?')
      .get(tag) as { count: number };
    return result.count > 0;
  }
};

// Ignored serials operations (for excluding dev/test devices from analytics)
export interface IgnoredSerial {
  id?: number;
  serial: string;
  label?: string;
  created_at?: string;
}

export const ignoredSerialDb = {
  getAll(): IgnoredSerial[] {
    return db.prepare('SELECT * FROM ignored_serials ORDER BY created_at DESC').all() as IgnoredSerial[];
  },

  getBySerial(serial: string): IgnoredSerial | undefined {
    return db.prepare('SELECT * FROM ignored_serials WHERE serial = ?').get(serial) as IgnoredSerial | undefined;
  },

  add(serial: string, label?: string): IgnoredSerial {
    const stmt = db.prepare('INSERT INTO ignored_serials (serial, label) VALUES (?, ?)');
    const result = stmt.run(serial, label || null);
    return db.prepare('SELECT * FROM ignored_serials WHERE id = ?').get(result.lastInsertRowid) as IgnoredSerial;
  },

  remove(serial: string): boolean {
    const stmt = db.prepare('DELETE FROM ignored_serials WHERE serial = ?');
    const result = stmt.run(serial);
    return result.changes > 0;
  },

  removeById(id: number): boolean {
    const stmt = db.prepare('DELETE FROM ignored_serials WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  exists(serial: string): boolean {
    const result = db.prepare('SELECT COUNT(*) as count FROM ignored_serials WHERE serial = ?')
      .get(serial) as { count: number };
    return result.count > 0;
  },

  // Get all unique serials from logs that aren't already ignored
  getAvailableSerials(): Array<{ serial: string; device_name: string; execution_count: number }> {
    return db.prepare(`
      SELECT 
        device_serial as serial,
        device_name,
        COUNT(*) as execution_count
      FROM execution_logs
      WHERE device_serial IS NOT NULL 
        AND device_serial NOT IN (SELECT serial FROM ignored_serials)
      GROUP BY device_serial
      ORDER BY execution_count DESC
    `).all() as any[];
  }
};

// Initialize database on module load
initializeDatabase();

export default db;

