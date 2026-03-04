import knex from './index.js';
import { cleanupExpiredMobRespawnsBatch } from './mobs.js';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = {
    execute: false,
    batchSize: 1000,
    maxRounds: 300,
    sleepMs: 80,
    maxDelete: 0,
    realmIds: []
  };

  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (!arg) continue;
    if (arg === '--execute') {
      options.execute = true;
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      options.batchSize = Math.max(50, Math.floor(Number(arg.split('=')[1]) || 1000));
      continue;
    }
    if (arg.startsWith('--max-rounds=')) {
      options.maxRounds = Math.max(1, Math.floor(Number(arg.split('=')[1]) || 300));
      continue;
    }
    if (arg.startsWith('--sleep-ms=')) {
      options.sleepMs = Math.max(0, Math.floor(Number(arg.split('=')[1]) || 80));
      continue;
    }
    if (arg.startsWith('--max-delete=')) {
      options.maxDelete = Math.max(0, Math.floor(Number(arg.split('=')[1]) || 0));
      continue;
    }
    if (arg.startsWith('--realm-id=')) {
      const parsed = Math.floor(Number(arg.split('=')[1]) || 0);
      if (Number.isFinite(parsed)) options.realmIds.push(parsed);
      continue;
    }
  }

  options.realmIds = Array.from(new Set(options.realmIds))
    .filter((id) => Number.isFinite(id) && id >= 0);
  return options;
}

async function countExpiredRows(nowMs, realmIds = []) {
  const query = knex('mob_respawns')
    .where('respawn_at', '<=', nowMs)
    .andWhere((q) => q.whereNull('current_hp').orWhere('current_hp', '<=', 0));
  if (Array.isArray(realmIds) && realmIds.length > 0) {
    query.whereIn('realm_id', realmIds);
  }
  const row = await query.count({ total: '*' }).first();
  return Math.max(0, Math.floor(Number(row?.total ?? row?.['count(*)'] ?? 0)));
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupExpiredMobRespawnsBatchByRealm(nowMs, limit, realmIds = []) {
  const now = Math.max(0, Math.floor(Number(nowMs) || 0));
  const batchSize = Math.max(1, Math.min(5000, Math.floor(Number(limit) || 1000)));
  const base = knex('mob_respawns')
    .where('respawn_at', '<=', now)
    .andWhere((q) => q.whereNull('current_hp').orWhere('current_hp', '<=', 0));
  if (Array.isArray(realmIds) && realmIds.length > 0) {
    base.whereIn('realm_id', realmIds);
  }
  const rows = await base
    .select('realm_id', 'zone_id', 'room_id', 'slot_index')
    .limit(batchSize);
  if (!rows.length) return 0;
  return knex('mob_respawns')
    .where((q) => {
      rows.forEach((row, index) => {
        const clause = {
          realm_id: row.realm_id,
          zone_id: row.zone_id,
          room_id: row.room_id,
          slot_index: row.slot_index
        };
        if (index === 0) q.where(clause);
        else q.orWhere(clause);
      });
    })
    .del();
}

export async function runMobRespawnCleanupCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  let stopRequested = false;
  process.on('SIGINT', () => {
    stopRequested = true;
    console.log('[mob-cleanup] SIGINT received, stopping after current batch...');
  });

  const now = Date.now();
  const before = await countExpiredRows(now, options.realmIds);
  const realmScope = options.realmIds.length > 0 ? options.realmIds.join(',') : 'all';
  console.log(
    `[mob-cleanup] candidates=${before} realms=${realmScope} batchSize=${options.batchSize} maxRounds=${options.maxRounds} sleepMs=${options.sleepMs} maxDelete=${options.maxDelete || 'unlimited'}`
  );

  if (!options.execute) {
    console.log('[mob-cleanup] dry-run only. Add --execute to start deletion.');
    return;
  }

  let totalDeleted = 0;
  let rounds = 0;

  while (!stopRequested && rounds < options.maxRounds) {
    const remainingCap = options.maxDelete > 0 ? (options.maxDelete - totalDeleted) : options.batchSize;
    if (remainingCap <= 0) break;
    const currentBatchSize = Math.max(1, Math.min(options.batchSize, remainingCap));
    const rawDeleted = options.realmIds.length > 0
      ? await cleanupExpiredMobRespawnsBatchByRealm(Date.now(), currentBatchSize, options.realmIds)
      : await cleanupExpiredMobRespawnsBatch(Date.now(), currentBatchSize);
    const deleted = Number(rawDeleted || 0);
    rounds += 1;
    totalDeleted += Math.max(0, deleted);
    console.log(`[mob-cleanup] round=${rounds} deleted=${deleted} total=${totalDeleted}`);

    if (deleted < currentBatchSize) break;
    if (options.maxDelete > 0 && totalDeleted >= options.maxDelete) break;
    await sleep(options.sleepMs);
  }

  const after = await countExpiredRows(Date.now(), options.realmIds);
  console.log(`[mob-cleanup] done rounds=${rounds} deleted=${totalDeleted} remaining=${after}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMobRespawnCleanupCli()
    .catch((err) => {
      console.error('[mob-cleanup] failed:', err?.message || err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await knex.destroy().catch(() => {});
    });
}
