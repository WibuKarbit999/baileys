import type { AuthStore } from './auth-store.js';

export interface NodeSqliteAdapterOptions {
    /** File path to the SQLite database, or `':memory:'`. */
    dbPath?: string;
    /** Existing `node:sqlite` `DatabaseSync` instance to reuse (will not be closed by `close()`). */
    database?: any;
    /** Existing `NodeSqliteAdapter` instance to reuse. */
    adapter?: NodeSqliteAdapter;
    /** Enable WAL journal mode for file-backed databases. Default: `true`. */
    wal?: boolean;
    /** SQLite `PRAGMA busy_timeout` in milliseconds. Default: `5000`. */
    busyTimeoutMs?: number;
    /** SQLite `PRAGMA synchronous` mode (`OFF` | `NORMAL` | `FULL` | `EXTRA`). Default: `'NORMAL'`. */
    synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA';
    /** Enable `PRAGMA foreign_keys = ON`. Default: `true`. */
    foreignKeys?: boolean;
    /** Open database in read-only mode. Default: `false`. */
    readOnly?: boolean;
}

export interface NodeSqliteCollection<T = any> {
    get: (key: string) => T | undefined;
    set: (key: string, value: T) => void;
    delete: (key: string) => boolean;
    has: (key: string) => boolean;
    keys: () => string[];
    entries: () => [string, T][];
    clear: () => void;
}

export interface NodeSqliteAuthStoreOptions {
    session?: string;
    table?: string;
    closeAdapter?: boolean;
}

export interface NodeSqliteAuthStore extends AuthStore {
    listSessions: () => Promise<string[]>;
}

export declare function loadNodeSqlite(): Promise<any>;

export declare class NodeSqliteAdapter {
    db: any;
    dbPath?: string;
    owned: boolean;
    closed: boolean;
    constructor(db: any, options?: { dbPath?: string; owned?: boolean });
    exec(sql: string): this;
    pragma(statement: string): any[];
    prepare(sql: string): any;
    run(sql: string, ...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get<T = Record<string, any>>(sql: string, ...params: any[]): T | undefined;
    all<T = Record<string, any>>(sql: string, ...params: any[]): T[];
    transaction<T>(fn: (adapter: NodeSqliteAdapter) => T, mode?: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE'): T;
    collection<T = any>(tableName?: string, options?: { useBufferJSON?: boolean }): NodeSqliteCollection<T>;
    createAuthStore(opts?: NodeSqliteAuthStoreOptions): NodeSqliteAuthStore;
    close(): void;
}

export declare function createNodeSqliteAdapter(opts?: string | NodeSqliteAdapterOptions): Promise<NodeSqliteAdapter>;

export declare function createNodeSqliteAuthStore(
    opts?: string | (NodeSqliteAdapterOptions & { session?: string; table?: string })
): Promise<NodeSqliteAuthStore>;
