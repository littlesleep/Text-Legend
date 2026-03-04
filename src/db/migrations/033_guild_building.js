export async function up(knex) {
  const hasGuilds = await knex.schema.hasTable('guilds');
  if (!hasGuilds) return;
  const hasBuildExp = await knex.schema.hasColumn('guilds', 'build_exp');
  const hasBuildGold = await knex.schema.hasColumn('guilds', 'build_gold');
  const hasBuildPoints = await knex.schema.hasColumn('guilds', 'build_points');
  if (!hasBuildExp || !hasBuildGold || !hasBuildPoints) {
    await knex.schema.alterTable('guilds', (t) => {
      if (!hasBuildExp) t.bigInteger('build_exp').notNullable().defaultTo(0);
      if (!hasBuildGold) t.bigInteger('build_gold').notNullable().defaultTo(0);
      if (!hasBuildPoints) t.bigInteger('build_points').notNullable().defaultTo(0);
    });
  }
}

export async function down(knex) {
  const hasGuilds = await knex.schema.hasTable('guilds');
  if (!hasGuilds) return;
  const hasBuildExp = await knex.schema.hasColumn('guilds', 'build_exp');
  const hasBuildGold = await knex.schema.hasColumn('guilds', 'build_gold');
  const hasBuildPoints = await knex.schema.hasColumn('guilds', 'build_points');
  if (hasBuildExp || hasBuildGold || hasBuildPoints) {
    await knex.schema.alterTable('guilds', (t) => {
      if (hasBuildExp) t.dropColumn('build_exp');
      if (hasBuildGold) t.dropColumn('build_gold');
      if (hasBuildPoints) t.dropColumn('build_points');
    });
  }
}
