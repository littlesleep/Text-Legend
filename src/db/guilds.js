import knex from './index.js';
import { validateGuildName } from '../game/validator.js';

const GUILD_BUILD_LEVEL_THRESHOLDS = [
  0,
  100000,
  300000,
  600000,
  1000000,
  1600000,
  2400000,
  3600000,
  5200000,
  7200000
];
const GUILD_BUILD_UPGRADE_DURATION_SEC = [
  0,
  300,
  900,
  1800,
  3600,
  7200,
  10800,
  14400,
  21600,
  28800
];
const GUILD_BUILD_MAX_LEVEL = GUILD_BUILD_LEVEL_THRESHOLDS.length - 1;

export function getGuildBuildLevel(buildExp = 0) {
  const exp = Math.max(0, Math.floor(Number(buildExp || 0)));
  let level = 0;
  for (let i = 0; i < GUILD_BUILD_LEVEL_THRESHOLDS.length; i += 1) {
    if (exp >= GUILD_BUILD_LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  return level;
}

function parseGuildBuildTimeMs(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

async function syncGuildBuildLevelBaseline(guild) {
  if (!guild?.id) return guild || null;
  const legacyLevel = getGuildBuildLevel(guild.build_exp || 0);
  const storedLevel = Math.max(0, Math.floor(Number(guild.build_level || 0)));
  if (legacyLevel > storedLevel) {
    await knex('guilds').where({ id: guild.id }).update({ build_level: legacyLevel });
    return { ...guild, build_level: legacyLevel };
  }
  return guild;
}

async function getGuildBuildingRow(guildId) {
  if (!guildId) return null;
  const guild = await knex('guilds')
    .where({ id: guildId })
    .select('id', 'build_exp', 'build_gold', 'build_points', 'build_level', 'build_upgrade_started_at', 'build_upgrade_ends_at')
    .first();
  if (!guild) return null;
  return syncGuildBuildLevelBaseline(guild);
}

async function completeGuildBuildingUpgradeIfReady(guildId) {
  const guild = await getGuildBuildingRow(guildId);
  if (!guild) return null;
  const endsAtMs = parseGuildBuildTimeMs(guild.build_upgrade_ends_at);
  if (!endsAtMs || endsAtMs > Date.now()) return guild;
  const baseLevel = Math.max(0, Math.floor(Number(guild.build_level || 0)));
  const nextLevel = Math.min(GUILD_BUILD_MAX_LEVEL, baseLevel + 1);
  await knex('guilds').where({ id: guildId }).update({
    build_level: nextLevel,
    build_upgrade_started_at: null,
    build_upgrade_ends_at: null
  });
  return getGuildBuildingRow(guildId);
}

export function buildGuildBuildingPayload(guild) {
  const buildExp = Math.max(0, Math.floor(Number(guild?.build_exp || 0)));
  const buildGold = Math.max(0, Math.floor(Number(guild?.build_gold || 0)));
  const buildPoints = Math.max(0, Math.floor(Number(guild?.build_points || 0)));
  const legacyLevel = getGuildBuildLevel(buildExp);
  const level = Math.max(
    Math.min(GUILD_BUILD_MAX_LEVEL, Math.max(0, Math.floor(Number(guild?.build_level || 0)))),
    legacyLevel
  );
  const currentThreshold = GUILD_BUILD_LEVEL_THRESHOLDS[level] || 0;
  const nextThreshold = GUILD_BUILD_LEVEL_THRESHOLDS[level + 1] || null;
  const upgradeStartedAt = parseGuildBuildTimeMs(guild?.build_upgrade_started_at);
  const upgradeEndsAt = parseGuildBuildTimeMs(guild?.build_upgrade_ends_at);
  const upgrading = Boolean(upgradeEndsAt && upgradeEndsAt > Date.now());
  const nextDurationSec = nextThreshold == null
    ? 0
    : Math.max(0, Math.floor(Number(GUILD_BUILD_UPGRADE_DURATION_SEC[level + 1] || 0)));
  return {
    level,
    exp: buildExp,
    gold: buildGold,
    points: buildPoints,
    currentThreshold,
    nextThreshold,
    nextNeed: nextThreshold == null ? 0 : Math.max(0, nextThreshold - buildExp),
    nextDurationSec,
    upgrading,
    upgradeStartedAt,
    upgradeEndsAt,
    upgradeRemainingSec: upgrading ? Math.max(0, Math.ceil((upgradeEndsAt - Date.now()) / 1000)) : 0,
    readyToUpgrade: !upgrading && nextThreshold != null && buildExp >= nextThreshold,
    rewardBonusPct: Math.min(30, level * 3),
    battleBonusPct: Math.min(18, level * 2)
  };
}

export async function getGuildByName(name) {
  return knex('guilds').where({ name }).first();
}

export async function getGuildByNameInRealm(name, realmId = 1) {
  return knex('guilds').where({ name, realm_id: realmId }).first();
}

export async function getGuildById(id) {
  return knex('guilds').where({ id }).first();
}

export async function createGuild(name, leaderUserId, leaderCharName, realmId = 1) {
  // 验证行会名称
  const nameResult = validateGuildName(name);
  if (!nameResult.ok) {
    const error = new Error(nameResult.error);
    error.code = 'VALIDATION_ERROR';
    throw error;
  }
  const [id] = await knex('guilds').insert({
    name: nameResult.value,
    leader_user_id: leaderUserId,
    leader_char_name: leaderCharName,
    realm_id: realmId
  });
  await knex('guild_members').insert({
    guild_id: id,
    user_id: leaderUserId,
    char_name: leaderCharName,
    role: 'leader',
    realm_id: realmId
  });
  return id;
}

export async function addGuildMember(guildId, userId, charName, realmId = 1) {
  await knex('guild_members').insert({
    guild_id: guildId,
    user_id: userId,
    char_name: charName,
    role: 'member',
    realm_id: realmId
  });
}

export async function removeGuildMember(guildId, userId, charName, realmId = 1) {
  await knex('guild_members').where({ guild_id: guildId, user_id: userId, char_name: charName, realm_id: realmId }).del();
}

export async function leaveGuild(userId, charName, realmId = 1) {
  const row = await knex('guild_members').where({ user_id: userId, char_name: charName, realm_id: realmId }).first();
  if (!row) return null;
  await knex('guild_members').where({ user_id: userId, char_name: charName, realm_id: realmId }).del();
  return row.guild_id;
}

export async function getGuildMember(userId, charName, realmId = 1) {
  const row = await knex('guild_members').where({ user_id: userId, char_name: charName, realm_id: realmId }).first();
  if (!row) return null;
  const guild = await getGuildById(row.guild_id);
  return { guild, role: row.role };
}

export async function listGuildMembers(guildId, realmId = 1) {
  return knex('guild_members')
    .leftJoin('characters', function joinCharacters() {
      this.on('guild_members.char_name', '=', 'characters.name').andOn('guild_members.realm_id', '=', 'characters.realm_id');
    })
    .where({ 'guild_members.guild_id': guildId, 'guild_members.realm_id': realmId })
    .select(
      'guild_members.char_name',
      'guild_members.role',
      'guild_members.user_id',
      'characters.level',
      knex.raw('characters.class as class_id')
    );
}

export async function isGuildLeader(guildId, userId, charName, realmId = 1) {
  const row = await knex('guild_members').where({ guild_id: guildId, user_id: userId, char_name: charName, realm_id: realmId }).first();
  console.log('[isGuildLeader] guildId:', guildId, 'userId:', userId, 'charName:', charName, 'row:', row);
  return row && row.role === 'leader';
}

export async function isGuildLeaderOrVice(guildId, userId, charName, realmId = 1) {
  const row = await knex('guild_members').where({ guild_id: guildId, user_id: userId, char_name: charName, realm_id: realmId }).first();
  return row && (row.role === 'leader' || row.role === 'vice_leader');
}

export async function setGuildMemberRole(guildId, userId, charName, role, realmId = 1) {
  const updated = await knex('guild_members')
    .where({ guild_id: guildId, user_id: userId, char_name: charName, realm_id: realmId })
    .update({ role });
  if (updated === 0) {
    throw new Error('成员记录不存在。');
  }
}

export async function transferGuildLeader(guildId, oldLeaderUserId, oldLeaderCharName, newLeaderUserId, newLeaderCharName, realmId = 1) {
  await knex.transaction(async (trx) => {
    const oldLeaderRows = await trx('guild_members')
      .where({ guild_id: guildId, user_id: oldLeaderUserId, char_name: oldLeaderCharName, realm_id: realmId })
      .update({ role: 'member' });
    if (oldLeaderRows === 0) {
      throw new Error('旧会长记录不存在或已更新。');
    }
    const newLeaderRows = await trx('guild_members')
      .where({ guild_id: guildId, user_id: newLeaderUserId, char_name: newLeaderCharName, realm_id: realmId })
      .update({ role: 'leader' });
    if (newLeaderRows === 0) {
      throw new Error('新会长记录不存在。');
    }
    await trx('guilds')
      .where({ id: guildId })
      .update({ leader_user_id: newLeaderUserId, leader_char_name: newLeaderCharName });
  });
}

export async function getSabakOwner(realmId = 1) {
  return knex('sabak_state').where({ realm_id: realmId }).first();
}

export async function setSabakOwner(realmId, guildId, guildName) {
  await knex('sabak_state')
    .where({ realm_id: realmId })
    .update({ owner_guild_id: guildId, owner_guild_name: guildName, updated_at: knex.fn.now() });
}

export async function ensureSabakState(realmId = 1) {
  const existing = await knex('sabak_state').where({ realm_id: realmId }).first();
  if (existing) return existing;
  const maxRow = await knex('sabak_state').max({ maxId: 'id' }).first();
  const nextId = Math.max(1, Math.floor(Number(maxRow?.maxId || 0) || 0) + 1);
  await knex('sabak_state').insert({
    id: nextId,
    realm_id: realmId,
    owner_guild_id: null,
    owner_guild_name: null
  });
  return knex('sabak_state').where({ realm_id: realmId }).first();
}

export async function registerSabak(guildId, realmId = 1) {
  await knex('sabak_registrations')
    .insert({ guild_id: guildId, registered_at: knex.fn.now(), realm_id: realmId })
    .onConflict(['guild_id'])
    .merge({ registered_at: knex.fn.now(), realm_id: realmId });
}

export async function listSabakRegistrations(realmId = 1) {
  return knex('sabak_registrations')
    .leftJoin('guilds', 'sabak_registrations.guild_id', 'guilds.id')
    .where('sabak_registrations.realm_id', realmId)
    .select('guilds.name as guild_name', 'sabak_registrations.guild_id', 'sabak_registrations.registered_at');
}

export async function hasSabakRegistrationToday(guildId, realmId = 1) {
  const isSqlite = knex.client.config.client === 'sqlite3';
  let query = knex('sabak_registrations').where({ guild_id: guildId, realm_id: realmId });
  if (isSqlite) {
    query = query
      .whereRaw("registered_at >= datetime('now','start of day','localtime')")
      .whereRaw("registered_at < datetime('now','start of day','localtime','+1 day')");
  } else {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    query = query.where('registered_at', '>=', start).where('registered_at', '<', end);
  }
  const row = await query.first();
  return !!row;
}

export async function hasAnySabakRegistrationToday(realmId = 1) {
  const isSqlite = knex.client.config.client === 'sqlite3';
  let query = knex('sabak_registrations').where({ realm_id: realmId });
  if (isSqlite) {
    query = query
      .whereRaw("registered_at >= datetime('now','start of day','localtime')")
      .whereRaw("registered_at < datetime('now','start of day','localtime','+1 day')");
  } else {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    query = query.where('registered_at', '>=', start).where('registered_at', '<', end);
  }
  const row = await query.first();
  return !!row;
}

export async function clearSabakRegistrations(realmId = 1) {
  await knex('sabak_registrations').where({ realm_id: realmId }).del();
}

// 行会申请相关
export async function applyToGuild(guildId, userId, charName, realmId = 1) {
  await knex('guild_applications')
    .insert({ guild_id: guildId, user_id: userId, char_name: charName, realm_id: realmId })
    .onConflict(['user_id', 'realm_id'])
    .merge({ guild_id: guildId, char_name: charName, applied_at: knex.fn.now() });
}

export async function listGuildApplications(guildId, realmId = 1) {
  return knex('guild_applications')
    .where({ guild_id: guildId, realm_id: realmId })
    .select('id', 'user_id', 'char_name', 'applied_at')
    .orderBy('applied_at', 'desc');
}

export async function removeGuildApplication(guildId, userId, realmId = 1) {
  await knex('guild_applications').where({ guild_id: guildId, user_id: userId, realm_id: realmId }).del();
}

export async function approveGuildApplication(guildId, userId, charName, realmId = 1) {
  await knex.transaction(async (trx) => {
    // 检查玩家是否已经在其他行会中
    const existingMember = await trx('guild_members')
      .where({ user_id: userId, realm_id: realmId })
      .first();
    if (existingMember) {
      const existingGuild = await trx('guilds').where({ id: existingMember.guild_id }).first();
      throw new Error(`该玩家已经在行会“${existingGuild.name}”中`);
    }

    // 删除申请记录
    await trx('guild_applications').where({ guild_id: guildId, user_id: userId, realm_id: realmId }).del();
    // 添加为行会成员
    await trx('guild_members').insert({
      guild_id: guildId,
      user_id: userId,
      char_name: charName,
      role: 'member',
      realm_id: realmId
    });
  });
}

export async function getApplicationByUser(userId, realmId = 1) {
  return knex('guild_applications').where({ user_id: userId, realm_id: realmId }).first();
}

export async function listAllGuilds(realmId = 1) {
  return knex('guilds').where({ realm_id: realmId }).select('id', 'name', 'leader_char_name').orderBy('name');
}

export async function getGuildBuildingInfo(guildId) {
  const guild = await completeGuildBuildingUpgradeIfReady(guildId);
  if (!guild) return null;
  return buildGuildBuildingPayload(guild);
}

export async function startGuildBuildingUpgrade(guildId) {
  const guild = await completeGuildBuildingUpgradeIfReady(guildId);
  if (!guild) return { ok: false, error: '行会不存在。', building: null };
  const building = buildGuildBuildingPayload(guild);
  if (building.upgrading) {
    return { ok: false, error: '行会建筑正在升级中。', building };
  }
  if (building.nextThreshold == null) {
    return { ok: false, error: '行会建筑已达到最高等级。', building };
  }
  if (building.exp < building.nextThreshold) {
    return { ok: false, error: `建设值不足，距离下一级还差 ${building.nextNeed}。`, building };
  }
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + Math.max(0, Number(building.nextDurationSec || 0)) * 1000);
  await knex('guilds')
    .where({ id: guildId })
    .update({
      build_upgrade_started_at: startedAt,
      build_upgrade_ends_at: endsAt
    });
  const nextGuild = await getGuildBuildingRow(guildId);
  return { ok: true, building: buildGuildBuildingPayload(nextGuild) };
}

export async function addGuildBuildingContribution(guildId, { gold = 0, points = 0 } = {}) {
  const goldValue = Math.max(0, Math.floor(Number(gold || 0)));
  const pointValue = Math.max(0, Math.floor(Number(points || 0)));
  const expGain = goldValue + pointValue * 10000;
  if (expGain <= 0) {
    return getGuildBuildingInfo(guildId);
  }
  await knex('guilds')
    .where({ id: guildId })
    .update({
      build_exp: knex.raw('COALESCE(build_exp, 0) + ?', [expGain]),
      build_gold: knex.raw('COALESCE(build_gold, 0) + ?', [goldValue]),
      build_points: knex.raw('COALESCE(build_points, 0) + ?', [pointValue])
    });
  return getGuildBuildingInfo(guildId);
}