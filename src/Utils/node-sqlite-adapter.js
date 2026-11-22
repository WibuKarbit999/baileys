import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BufferJSON } from './generics.js';

const READ_MANY_CHUNK_SIZE = 500;
const VALID_SYNC_MODES = new Set(['OFF', 'NORMAL', 'FULL', 'EXTRA']);
const VALID_TX_MODES = new Set(['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE']);

const quoteIdentifier = (name, label = 'identifier') => {
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`${label} must be a plain SQL identifier, got ${JSON.stringify(name)}`);
    }
    return `"${name}"`;
};

export async function loadNodeSqlite() {
    try {
        return await import('node:sqlite');
    }
    catch (err) {
        const helpful = new Error(
            'Built-in `node:sqlite` is not available in this Node.js runtime. '
            + `Upgrade to Node.js >= 22.5.0 (current: ${process.versions.node}), `
            + 'or use `useSqliteAuthState` with `better-sqlite3` or `useMultiFileAuthState`.'
        );
        helpful.cause = err;
        throw helpful;
    }
}

export class NodeSqliteAdapter {
    constructor(db, options = {}) {
        this.db = db;
        this.dbPath = options.dbPath;
        this.owned = Boolean(options.owned);
        this.closed = false;
        this._stmts = new Map();
        this._txDepth = 0;
        this._savepointSeq = 0;
    }

    _assertOpen() {
        if (this.closed) {
            throw new Error('NodeSqliteAdapter is already closed');
        }
    }

    exec(sql) {
        this._assertOpen();
        this.db.exec(sql);
        return this;
    }

    pragma(statement) {
        this._assertOpen();
        const sql = statement.trim().toUpperCase().startsWith('PRAGMA')
            ? statement
            : `PRAGMA ${statement}`;
        return this.db.prepare(sql).all();
    }

    prepare(sql) {
        this._assertOpen();
        let stmt = this._stmts.get(sql);
        if (!stmt) {
            stmt = this.db.prepare(sql);
            this._stmts.set(sql, stmt);
        }
        return stmt;
    }

    run(sql, ...params) {
        return this.prepare(sql).run(...params);
    }

    get(sql, ...params) {
        return this.prepare(sql).get(...params);
    }

    all(sql, ...params) {
        return this.prepare(sql).all(...params);
    }

    transaction(fn, mode = 'IMMEDIATE') {
        this._assertOpen();
        const txMode = String(mode).toUpperCase();
        if (!VALID_TX_MODES.has(txMode)) {
            throw new Error(`Invalid SQLite transaction mode: ${mode}`);
        }
        if (this._txDepth > 0) {
            const sp = `sp_${++this._savepointSeq}`;
            this.db.exec(`SAVEPOINT ${sp}`);
            this._txDepth++;
            try {
                const result = fn(this);
                this.db.exec(`RELEASE SAVEPOINT ${sp}`);
                return result;
            }
            catch (err) {
                this.db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
                this.db.exec(`RELEASE SAVEPOINT ${sp}`);
                throw err;
            }
            finally {
                this._txDepth--;
            }
        }
        this.db.exec(`BEGIN ${txMode}`);
        this._txDepth++;
        try {
            const result = fn(this);
            this.db.exec('COMMIT');
            return result;
        }
        catch (err) {
            try {
                this.db.exec('ROLLBACK');
            }
            catch {
            }
            throw err;
        }
        finally {
            this._txDepth--;
        }
    }

    collection(tableName = 'baileys_kv', { useBufferJSON = true } = {}) {
        const table = quoteIdentifier(tableName, 'table name');
        this.exec(`
            CREATE TABLE IF NOT EXISTS ${table} (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
        const replacer = useBufferJSON ? BufferJSON.replacer : undefined;
        const reviver = useBufferJSON ? BufferJSON.reviver : undefined;
        const selectSql = `SELECT value FROM ${table} WHERE key = ?`;
        const upsertSql = `INSERT INTO ${table} (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`;
        const deleteSql = `DELETE FROM ${table} WHERE key = ?`;
        const hasSql = `SELECT 1 AS ok FROM ${table} WHERE key = ? LIMIT 1`;
        const keysSql = `SELECT key FROM ${table} ORDER BY key`;
        const allSql = `SELECT key, value FROM ${table} ORDER BY key`;
        const clearSql = `DELETE FROM ${table}`;

        return {
            get: (key) => {
                const row = this.get(selectSql, String(key));
                return row ? JSON.parse(row.value, reviver) : undefined;
            },
            set: (key, value) => {
                this.run(upsertSql, String(key), JSON.stringify(value, replacer));
            },
            delete: (key) => {
                return Number(this.run(deleteSql, String(key)).changes) > 0;
            },
            has: (key) => {
                return Boolean(this.get(hasSql, String(key)));
            },
            keys: () => {
                return this.all(keysSql).map(row => row.key);
            },
            entries: () => {
                return this.all(allSql).map(row => [row.key, JSON.parse(row.value, reviver)]);
            },
            clear: () => {
                this.run(clearSql);
            }
        };
    }

    createAuthStore(opts = {}) {
        const rawTable = opts.table ?? 'baileys_auth';
        const table = quoteIdentifier(rawTable, 'table name');
        const idx = quoteIdentifier(`${rawTable}_session_type_idx`, 'index name');
        const session = String(opts.session ?? 'default');
        const closeAdapterOnClose = opts.closeAdapter ?? false;

        this.exec(`
            CREATE TABLE IF NOT EXISTS ${table} (
                session TEXT NOT NULL,
                type TEXT NOT NULL,
                id TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (session, type, id)
            );
            CREATE INDEX IF NOT EXISTS ${idx} ON ${table} (session, type);
        `);

        const readSql = `SELECT value FROM ${table} WHERE session = ? AND type = ? AND id = ?`;
        const writeSql = `INSERT INTO ${table} (session, type, id, value, updated_at) VALUES (?, ?, ?, ?, unixepoch()) ON CONFLICT(session, type, id) DO UPDATE SET value = excluded.value, updated_at = unixepoch()`;
        const deleteSql = `DELETE FROM ${table} WHERE session = ? AND type = ? AND id = ?`;
        const clearSql = `DELETE FROM ${table} WHERE session = ?`;
        const listSessionsSql = `SELECT DISTINCT session FROM ${table} ORDER BY session`;

        return {
            read: async (type, id) => {
                const row = this.get(readSql, session, type, id);
                return row?.value ?? null;
            },
            readMany: async (type, ids) => {
                if (!ids.length) {
                    return {};
                }
                const rows = {};
                for (let i = 0; i < ids.length; i += READ_MANY_CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + READ_MANY_CHUNK_SIZE);
                    const placeholders = chunk.map(() => '?').join(', ');
                    const sql = `SELECT id, value FROM ${table} WHERE session = ? AND type = ? AND id IN (${placeholders})`;
                    const found = this.db.prepare(sql).all(session, type, ...chunk);
                    for (const row of found) {
                        rows[row.id] = row.value;
                    }
                }
                return rows;
            },
            write: async (type, id, value) => {
                this.run(writeSql, session, type, id, value);
            },
            apply: async (writes, removals) => {
                this.transaction(() => {
                    const upsert = this.prepare(writeSql);
                    const del = this.prepare(deleteSql);
                    for (const entry of writes) {
                        upsert.run(session, entry.type, entry.id, entry.value);
                    }
                    for (const entry of removals) {
                        del.run(session, entry.type, entry.id);
                    }
                });
            },
            clear: async () => {
                this.run(clearSql, session);
            },
            listSessions: async () => {
                return this.all(listSessionsSql).map(row => row.session);
            },
            close: async () => {
                if (closeAdapterOnClose) {
                    this.close();
                }
            }
        };
    }

    close() {
        if (this.closed) {
            return;
        }
        this._stmts.clear();
        if (this.owned) {
            this.db.close();
        }
        this.closed = true;
    }
}

export async function createNodeSqliteAdapter(opts = {}) {
    const normalized = typeof opts === 'string' ? { dbPath: opts } : (opts ?? {});
    if (normalized.adapter instanceof NodeSqliteAdapter) {
        return normalized.adapter;
    }

    let db = normalized.database;
    let owned = false;
    const dbPath = normalized.dbPath;

    if (!db) {
        if (!dbPath) {
            throw new Error('createNodeSqliteAdapter needs a `dbPath` (or `:memory:`) or an existing `database` (`node:sqlite` DatabaseSync)');
        }
        if (dbPath !== ':memory:' && !dbPath.startsWith('file:')) {
            mkdirSync(dirname(dbPath), { recursive: true });
        }
        const { DatabaseSync } = await loadNodeSqlite();
        const openOpts = {};
        if (typeof normalized.readOnly === 'boolean') {
            openOpts.readOnly = normalized.readOnly;
        }
        db = Object.keys(openOpts).length ? new DatabaseSync(dbPath, openOpts) : new DatabaseSync(dbPath);
        owned = true;
    }

    const adapter = new NodeSqliteAdapter(db, { dbPath, owned });
    const busyTimeoutMs = normalized.busyTimeoutMs ?? 5000;
    if (Number.isFinite(busyTimeoutMs) && busyTimeoutMs >= 0) {
        adapter.exec(`PRAGMA busy_timeout = ${Math.floor(busyTimeoutMs)}`);
    }
    const isMemory = dbPath === ':memory:';
    if (!normalized.readOnly && normalized.wal !== false && !isMemory) {
        adapter.exec('PRAGMA journal_mode = WAL');
    }
    const syncMode = String(normalized.synchronous ?? 'NORMAL').toUpperCase();
    if (!normalized.readOnly && VALID_SYNC_MODES.has(syncMode)) {
        adapter.exec(`PRAGMA synchronous = ${syncMode}`);
    }
    if (normalized.foreignKeys !== false) {
        adapter.exec('PRAGMA foreign_keys = ON');
    }
    return adapter;
}

export async function createNodeSqliteAuthStore(opts = {}) {
    const normalized = typeof opts === 'string' ? { dbPath: opts } : (opts ?? {});
    const reusedExternal = Boolean(normalized.adapter || normalized.database);
    const adapter = await createNodeSqliteAdapter(normalized);
    return adapter.createAuthStore({
        session: normalized.session,
        table: normalized.table,
        closeAdapter: !reusedExternal
    });
}
