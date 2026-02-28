export async function up(knex) {
  const client = String(knex?.client?.config?.client || '').toLowerCase();
  const isMysql = client.includes('mysql');
  const hasTable = await knex.schema.hasTable('deleted_characters');
  if (!hasTable) {
    await knex.schema.createTable('deleted_characters', (t) => {
      t.increments('id').primary();
      t.integer('source_character_id').nullable();
      t.integer('user_id').unsigned().notNullable();
      t.integer('realm_id').notNullable().defaultTo(1);
      t.string('name', 64).notNullable();
      if (isMysql) t.specificType('payload_json', 'LONGTEXT').notNullable();
      else t.text('payload_json').notNullable();
      t.timestamp('deleted_at').defaultTo(knex.fn.now());
      t.timestamp('restored_at').nullable();
      t.integer('restored_character_id').nullable();
      t.index(['realm_id', 'name'], 'deleted_characters_realm_name_idx');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('deleted_characters');
}
