export async function up(knex) {
  const hasConsign = await knex.schema.hasTable('consignments');
  if (hasConsign) {
    const hasGrowthLevel = await knex.schema.hasColumn('consignments', 'growth_level');
    const hasGrowthFailStack = await knex.schema.hasColumn('consignments', 'growth_fail_stack');
    if (!hasGrowthLevel || !hasGrowthFailStack) {
      await knex.schema.alterTable('consignments', (t) => {
        if (!hasGrowthLevel) t.integer('growth_level');
        if (!hasGrowthFailStack) t.integer('growth_fail_stack');
      });
    }
  }

  const hasHistory = await knex.schema.hasTable('consignment_history');
  if (hasHistory) {
    const hasGrowthLevel = await knex.schema.hasColumn('consignment_history', 'growth_level');
    const hasGrowthFailStack = await knex.schema.hasColumn('consignment_history', 'growth_fail_stack');
    if (!hasGrowthLevel || !hasGrowthFailStack) {
      await knex.schema.alterTable('consignment_history', (t) => {
        if (!hasGrowthLevel) t.integer('growth_level');
        if (!hasGrowthFailStack) t.integer('growth_fail_stack');
      });
    }
  }
}

export async function down(knex) {
  const hasConsign = await knex.schema.hasTable('consignments');
  if (hasConsign) {
    const hasGrowthLevel = await knex.schema.hasColumn('consignments', 'growth_level');
    const hasGrowthFailStack = await knex.schema.hasColumn('consignments', 'growth_fail_stack');
    if (hasGrowthLevel || hasGrowthFailStack) {
      await knex.schema.alterTable('consignments', (t) => {
        if (hasGrowthLevel) t.dropColumn('growth_level');
        if (hasGrowthFailStack) t.dropColumn('growth_fail_stack');
      });
    }
  }

  const hasHistory = await knex.schema.hasTable('consignment_history');
  if (hasHistory) {
    const hasGrowthLevel = await knex.schema.hasColumn('consignment_history', 'growth_level');
    const hasGrowthFailStack = await knex.schema.hasColumn('consignment_history', 'growth_fail_stack');
    if (hasGrowthLevel || hasGrowthFailStack) {
      await knex.schema.alterTable('consignment_history', (t) => {
        if (hasGrowthLevel) t.dropColumn('growth_level');
        if (hasGrowthFailStack) t.dropColumn('growth_fail_stack');
      });
    }
  }
}
