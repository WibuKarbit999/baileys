import { makeAuthStateFromStore } from './auth-store.js';
import { createNodeSqliteAdapter } from './node-sqlite-adapter.js';

/**
 * WhatsApp auth/session state backed by Node.js's built-in `node:sqlite` (`DatabaseSync`).
 *
 * Additive alternative to `useMultiFileAuthState`, `useSingleFileAuthState`, and
 * `useSqliteAuthState` (`better-sqlite3`) — requires zero external native dependencies
 * on Node.js >= 22.5.0 and supports multiple sessions in a single `.db` file via `session`.
 */
export async function useNodeSqliteAuthState(opts = {}) {
    const normalized = typeof opts === 'string' ? { dbPath: opts } : (opts ?? {});
    const reusedExternal = Boolean(normalized.adapter || normalized.database);
    const adapter = await createNodeSqliteAdapter(normalized);
    const store = adapter.createAuthStore({
        session: normalized.session,
        table: normalized.table,
        closeAdapter: !reusedExternal
    });
    const auth = await makeAuthStateFromStore(store);
    return {
        ...auth,
        adapter,
        listSessions: store.listSessions
    };
}
