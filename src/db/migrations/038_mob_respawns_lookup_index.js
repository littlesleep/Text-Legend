export async function up(knex) {
  // 为 mob_respawns 的 realm_id 单列查询添加索引（用于范围清理）
  if (await knex.schema.hasTable('mob_respawns')) {
    try {
      await knex.schema.alterTable('mob_respawns', (t) => {
        t.index(['realm_id'], 'idx_mob_respawns_realm_id');
      });
    } catch {
      // 索引可能已存在
    }
  }

  // 为 characters 表的 realm_id 查询添加单列索引
  if (await knex.schema.hasTable('characters')) {
    try {
      await knex.schema.alterTable('characters', (t) => {
        t.index(['realm_id'], 'idx_characters_realm_id');
      });
    } catch {
      // 索引可能已存在
    }
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('mob_respawns')) {
    try {
      await knex.schema.alterTable('mob_respawns', (t) => {
        t.dropIndex(['realm_id'], 'idx_mob_respawns_realm_id');
      });
    } catch {
      // 忽略
    }
  }

  if (await knex.schema.hasTable('characters')) {
    try {
      await knex.schema.alterTable('characters', (t) => {
        t.dropIndex(['realm_id'], 'idx_characters_realm_id');
      });
    } catch {
      // 忽略
    }
  }
}
