async function addIndex(knex, tableName, columns, indexName) {
  try {
    await knex.schema.alterTable(tableName, (t) => {
      t.index(columns, indexName);
    });
  } catch {
    // ignore duplicate / already exists / unsupported alter
  }
}

async function dropIndex(knex, tableName, columns, indexName) {
  try {
    await knex.schema.alterTable(tableName, (t) => {
      t.dropIndex(columns, indexName);
    });
  } catch {
    // ignore missing index / unsupported alter
  }
}

export async function up(knex) {
  if (await knex.schema.hasTable('characters')) {
    await addIndex(knex, 'characters', ['realm_id', 'name'], 'idx_characters_realm_name');
    await addIndex(knex, 'characters', ['user_id', 'realm_id'], 'idx_characters_user_realm');
  }

  if (await knex.schema.hasTable('sessions')) {
    await addIndex(knex, 'sessions', ['user_id'], 'idx_sessions_user_id');
    await addIndex(knex, 'sessions', ['last_seen'], 'idx_sessions_last_seen');
  }

  if (await knex.schema.hasTable('mob_respawns')) {
    await addIndex(knex, 'mob_respawns', ['zone_id', 'template_id', 'realm_id'], 'idx_mob_respawns_zone_template_realm');
  }
}

export async function down(knex) {
  if (await knex.schema.hasTable('mob_respawns')) {
    await dropIndex(knex, 'mob_respawns', ['zone_id', 'template_id', 'realm_id'], 'idx_mob_respawns_zone_template_realm');
  }

  if (await knex.schema.hasTable('sessions')) {
    await dropIndex(knex, 'sessions', ['last_seen'], 'idx_sessions_last_seen');
    await dropIndex(knex, 'sessions', ['user_id'], 'idx_sessions_user_id');
  }

  if (await knex.schema.hasTable('characters')) {
    await dropIndex(knex, 'characters', ['user_id', 'realm_id'], 'idx_characters_user_realm');
    await dropIndex(knex, 'characters', ['realm_id', 'name'], 'idx_characters_realm_name');
  }
}
