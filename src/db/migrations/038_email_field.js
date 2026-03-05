export async function up(knex) {
  const hasEmail = await knex.schema.hasColumn('users', 'email');
  if (!hasEmail) {
    await knex.schema.table('users', (t) => {
      t.string('email', 255).nullable().unique();
    });
  }

  const hasIsAdmin = await knex.schema.hasColumn('users', 'is_admin');
  if (!hasIsAdmin) {
    await knex.schema.table('users', (t) => {
      t.boolean('is_admin').defaultTo(false);
    });
  }

  const hasPasswordResetTokens = await knex.schema.hasTable('password_reset_tokens');
  if (!hasPasswordResetTokens) {
    await knex.schema.createTable('password_reset_tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
      t.string('token', 255).notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('used_at').nullable();
    });
  }
}

export async function down(knex) {
  const hasPasswordResetTokens = await knex.schema.hasTable('password_reset_tokens');
  if (hasPasswordResetTokens) {
    await knex.schema.dropTable('password_reset_tokens');
  }

  const hasEmail = await knex.schema.hasColumn('users', 'email');
  if (hasEmail) {
    await knex.schema.table('users', (t) => {
      t.dropColumn('email');
    });
  }
}
