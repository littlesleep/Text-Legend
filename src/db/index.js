import knexModule from 'knex';
import config from '../config.js';

const isSqlite = config.db.client === 'sqlite';

const knex = knexModule({
  client: isSqlite ? 'sqlite3' : 'mysql2',
  connection: isSqlite
    ? {
        filename: config.db.filename,
        busyTimeout: 5000 // SQLite: 等待5秒获取数据库锁
      }
    : {
        host: config.db.host,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database
      },
  useNullAsDefault: isSqlite,
  pool: { min: 0, max: config.db.poolMax }
});

if (isSqlite) {
  if (config.db.sqlite?.wal) {
    knex.raw('PRAGMA journal_mode = WAL;').catch(() => {});
  }
  if (config.db.sqlite?.synchronous) {
    knex.raw(`PRAGMA synchronous = ${config.db.sqlite.synchronous};`).catch(() => {});
  }
}

function toCompactSql(sqlText) {
  return String(sqlText || '')
    .replace(/\s+/g, ' ')
    .trim();
}

if (config.db.slowQueryLog && Number.isFinite(config.db.slowQueryMs) && config.db.slowQueryMs > 0) {
  const slowThresholdMs = Math.max(1, Math.floor(config.db.slowQueryMs));
  const queryStartAt = new Map();

  const begin = (query) => {
    if (!query || query.__knexQueryUid === undefined || query.__knexQueryUid === null) return;
    queryStartAt.set(query.__knexQueryUid, Date.now());
  };

  const finish = (query, error = null) => {
    if (!query || query.__knexQueryUid === undefined || query.__knexQueryUid === null) return;
    const startedAt = queryStartAt.get(query.__knexQueryUid);
    queryStartAt.delete(query.__knexQueryUid);
    if (!startedAt) return;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < slowThresholdMs) return;

    const sql = toCompactSql(query.sql).slice(0, 300);
    const bindingsCount = Array.isArray(query.bindings) ? query.bindings.length : 0;
    const tag = error ? '[db][slow][error]' : '[db][slow]';
    const suffix = error ? ` err=${String(error?.message || error)}` : '';
    console.warn(`${tag} ${elapsedMs}ms bindings=${bindingsCount} sql="${sql}"${suffix}`);
  };

  knex.on('query', begin);
  knex.on('query-response', (_response, query) => {
    finish(query, null);
  });
  knex.on('query-error', (error, query) => {
    finish(query, error);
  });
}

export default knex;
