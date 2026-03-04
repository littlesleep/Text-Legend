export const up = async function up(knex) {
  const hasTable = await knex.schema.hasTable('guilds');
  if (!hasTable) return;

  const hasBranchLevels = await knex.schema.hasColumn('guilds', 'build_branch_levels');
  const hasUpgradeBranch = await knex.schema.hasColumn('guilds', 'build_upgrade_branch');

  if (!hasBranchLevels || !hasUpgradeBranch) {
    await knex.schema.alterTable('guilds', (t) => {
      if (!hasBranchLevels) t.text('build_branch_levels').nullable();
      if (!hasUpgradeBranch) t.string('build_upgrade_branch', 32).nullable();
    });
  }
};

export const down = async function down(knex) {
  const hasTable = await knex.schema.hasTable('guilds');
  if (!hasTable) return;

  const hasBranchLevels = await knex.schema.hasColumn('guilds', 'build_branch_levels');
  const hasUpgradeBranch = await knex.schema.hasColumn('guilds', 'build_upgrade_branch');

  if (hasBranchLevels || hasUpgradeBranch) {
    await knex.schema.alterTable('guilds', (t) => {
      if (hasBranchLevels) t.dropColumn('build_branch_levels');
      if (hasUpgradeBranch) t.dropColumn('build_upgrade_branch');
    });
  }
};
