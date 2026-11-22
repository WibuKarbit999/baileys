import type { NodeSqliteAdapter, NodeSqliteAdapterOptions } from './node-sqlite-adapter.js';

export interface NodeSqliteAuthStateOptions extends NodeSqliteAdapterOptions {
    /** Logical session namespace inside the SQLite table (allows multiple WA accounts in one `.db`). Default: `'default'`. */
    session?: string;
    /** SQLite table name storing creds and Signal keys. Default: `'baileys_auth'`. */
    table?: string;
}

export declare function useNodeSqliteAuthState(opts?: string | NodeSqliteAuthStateOptions): Promise<{
    state: {
        creds: any;
        keys: {
            get: (type: any, ids: any) => Promise<Record<string, any>>;
            set: (data: any) => Promise<void>;
        };
    };
    saveCreds: () => Promise<void>;
    clearAuth: () => Promise<void>;
    close: () => Promise<void>;
    adapter: NodeSqliteAdapter;
    listSessions: () => Promise<string[]>;
}>;
