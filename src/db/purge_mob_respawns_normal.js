import knex from './index.js';
import { MOB_TEMPLATES } from '../game/mobs.js';
import { pathToFileURL } from 'node:url';

function isBossLikeTemplate(tpl) {
  const templateId = String(tpl?.id || '');
  if (!tpl || tpl.summoned) return false;
  return Boolean(
    tpl.worldBoss
    || tpl.specialBoss
    || tpl.sabakBoss
    || (tpl.respawnMs && Number(tpl.respawnMs) > 0)
    || templateId === 'vip_personal_boss'
    || templateId === 'svip_personal_boss'
    || templateId === 'cross_world_boss'
    || templateId.startsWith('cultivation_boss_')
    || templateId.includes('boss')
    || templateId.includes('leader')
    || templateId.includes('demon')
    || templateId === 'bug_queen'
    || templateId === 'huangquan'
  );
}

function buildPersistedTemplateIdSet() {
  const ids = new Set();
  Object.values(MOB_TEMPLATES).forEach((tpl) => {
    if (!tpl || !tpl.id) return;
    if (isBossLikeTemplate(tpl)) ids.add(String(tpl.id));
  });
  return ids;
}

function parseArgs(argv) {
  const options = {
    execute: false,
    batchSize: 2000,
    maxRounds: 400,
    sleepMs: 60,
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
      options.batchSize = Math.max(50, Math.min(5000, Math.floor(Number(arg.split('=')[1]) || 2000)));
      continue;
    }
    if (arg.startsWith('--max-rounds=')) {
      options.maxRounds = Math.max(1, Math.floor(Number(arg.split('=')[1]) || 400));
      continue;
    }
    if (arg.startsWith('--sleep-ms=')) {
      options.sleepMs = Math.max(0, Math.floor(Number(arg.split('=')[1]) || 60));
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

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function applyFilters(query, persistedTemplateIds, realmIds = []) {
  query.whereNotIn('template_id', persistedTemplateIds);
  if (Array.isArray(realmIds) && realmIds.length > 0) {
    query.whereIn('realm_id', realmIds);
  }
  return query;
}

async function countCandidates(persistedTemplateIds, realmIds = []) {
  const query = knex('mob_respawns');
  applyFilters(query, persistedTemplateIds, realmIds);
  const row = await query.count({ total: '*' }).first();
  return Math.max(0, Math.floor(Number(row?.total ?? row?.['count(*)'] ?? 0)));
}

async function deleteBatch(persistedTemplateIds, batchSize, realmIds = []) {
  const query = knex('mob_respawns')
    .select('realm_id', 'zone_id', 'room_id', 'slot_index')
    .limit(batchSize);
  applyFilters(query, persistedTemplateIds, realmIds);
  const rows = await query;
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

export async function runPurgeNormalMobRespawnsCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const persistedTemplateIds = Array.from(buildPersistedTemplateIdSet());
  const realmScope = options.realmIds.length > 0 ? options.realmIds.join(',') : 'all';
  const candidates = await countCandidates(persistedTemplateIds, options.realmIds);
  console.log(
    `[mob-purge-normal] candidates=${candidates} realms=${realmScope} keepTemplates=${persistedTemplateIds.length} batchSize=${options.batchSize} maxRounds=${options.maxRounds} sleepMs=${options.sleepMs} maxDelete=${options.maxDelete || 'unlimited'}`
  );
  if (!options.execute) {
    console.log('[mob-purge-normal] dry-run only. Add --execute to start deletion.');
    return;
  }

  let rounds = 0;
  let totalDeleted = 0;
  while (rounds < options.maxRounds) {
    const cap = options.maxDelete > 0 ? (options.maxDelete - totalDeleted) : options.batchSize;
    if (cap <= 0) break;
    const deleted = Number(await deleteBatch(persistedTemplateIds, Math.min(options.batchSize, cap), options.realmIds) || 0);
    rounds += 1;
    totalDeleted += Math.max(0, deleted);
    console.log(`[mob-purge-normal] round=${rounds} deleted=${deleted} total=${totalDeleted}`);
    if (deleted < Math.min(options.batchSize, cap)) break;
    if (options.maxDelete > 0 && totalDeleted >= options.maxDelete) break;
    await sleep(options.sleepMs);
  }
  const remaining = await countCandidates(persistedTemplateIds, options.realmIds);
  console.log(`[mob-purge-normal] done rounds=${rounds} deleted=${totalDeleted} remaining=${remaining}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPurgeNormalMobRespawnsCli()
    .catch((err) => {
      console.error('[mob-purge-normal] failed:', err?.message || err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await knex.destroy().catch(() => {});
    });
}
