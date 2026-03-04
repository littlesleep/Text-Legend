export async function up(knex) {
  const hasGuilds = await knex.schema.hasTable('guilds');
  if (!hasGuilds) return;
  const hasBuildLevel = await knex.schema.hasColumn('guilds', 'build_level');
  const hasBuildUpgradeStartedAt = await knex.schema.hasColumn('guilds', 'build_upgrade_started_at');
  const hasBuildUpgradeEndsAt = await knex.schema.hasColumn('guilds', 'build_upgrade_ends_at');
  if (!hasBuildLevel || !hasBuildUpgradeStartedAt || !hasBuildUpgradeEndsAt) {
    await knex.schema.alterTable('guilds', (t) => {
      if (!hasBuildLevel) t.integer('build_level').notNullable().defaultTo(0);
      if (!hasBuildUpgradeStartedAt) t.dateTime('build_upgrade_started_at').nullable();
      if (!hasBuildUpgradeEndsAt) t.dateTime('build_upgrade_ends_at').nullable();
    });
  }
}

export async function down(knex) {
  const hasGuilds = await knex.schema.hasTable('guilds');
  if (!hasGuilds) return;
  const hasBuildLevel = await knex.schema.hasColumn('guilds', 'build_level');
  const hasBuildUpgradeStartedAt = await knex.schema.hasColumn('guilds', 'build_upgrade_started_at');
  const hasBuildUpgradeEndsAt = await knex.schema.hasColumn('guilds', 'build_upgrade_ends_at');
  if (hasBuildLevel || hasBuildUpgradeStartedAt || hasBuildUpgradeEndsAt) {
    await knex.schema.alterTable('guilds', (t) => {
      if (hasBuildLevel) t.dropColumn('build_level');
      if (hasBuildUpgradeStartedAt) t.dropColumn('build_upgrade_started_at');
      if (hasBuildUpgradeEndsAt) t.dropColumn('build_upgrade_ends_at');
    });
  }
}
