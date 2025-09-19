import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['pelapor', 'admin']);
export const reportStatusEnum = pgEnum('report_status', ['baru', 'proses', 'selesai']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Reports table
export const reportsTable = pgTable('reports', {
  id: serial('id').primaryKey(),
  npsn: text('npsn').notNull(), // 8 digit school identifier
  school_name: text('school_name').notNull(),
  category_id: integer('category_id').notNull(),
  issue_description: text('issue_description').notNull(),
  nisn: text('nisn'), // 10 digit student identifier, nullable
  status: reportStatusEnum('status').notNull().default('baru'),
  reporter_id: integer('reporter_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Report progress table for tracking status changes and admin notes
export const reportProgressTable = pgTable('report_progress', {
  id: serial('id').primaryKey(),
  report_id: integer('report_id').notNull(),
  admin_id: integer('admin_id'), // nullable for system-generated entries
  status: reportStatusEnum('status').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  reports: many(reportsTable),
  progress_entries: many(reportProgressTable),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  reports: many(reportsTable),
}));

export const reportsRelations = relations(reportsTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [reportsTable.category_id],
    references: [categoriesTable.id],
  }),
  reporter: one(usersTable, {
    fields: [reportsTable.reporter_id],
    references: [usersTable.id],
  }),
  progress: many(reportProgressTable),
}));

export const reportProgressRelations = relations(reportProgressTable, ({ one }) => ({
  report: one(reportsTable, {
    fields: [reportProgressTable.report_id],
    references: [reportsTable.id],
  }),
  admin: one(usersTable, {
    fields: [reportProgressTable.admin_id],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Report = typeof reportsTable.$inferSelect;
export type NewReport = typeof reportsTable.$inferInsert;

export type ReportProgress = typeof reportProgressTable.$inferSelect;
export type NewReportProgress = typeof reportProgressTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  categories: categoriesTable,
  reports: reportsTable,
  reportProgress: reportProgressTable
};