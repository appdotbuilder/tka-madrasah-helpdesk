import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createReportInputSchema,
  updateReportInputSchema,
  createReportProgressInputSchema,
  reportFilterSchema
} from './schema';

// Import handlers
import { login, getCurrentUser } from './handlers/auth';
import { 
  createUser, 
  getUsers, 
  getUserById, 
  updateUser, 
  deleteUser, 
  resetUserPassword 
} from './handlers/users';
import {
  createCategory,
  getCategories,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from './handlers/categories';
import {
  createReport,
  getReports,
  getReportsByUser,
  getReportById,
  updateReport,
  deleteReport,
  updateReportStatus
} from './handlers/reports';
import {
  createReportProgress,
  getReportProgress,
  addProgressNote
} from './handlers/progress';
import {
  getUserDashboard,
  getAdminDashboard,
  getReportsSummary
} from './handlers/dashboard';
import {
  exportReportsToCSV,
  exportReportsSummaryToCSV
} from './handlers/export';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    
    getCurrentUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getCurrentUser(input.userId)),
  }),

  // User management routes (admin)
  users: router({
    create: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => createUser(input)),
    
    getAll: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        role: z.enum(['pelapor', 'admin']).optional(),
        is_active: z.boolean().optional(),
        page: z.number().default(1),
        limit: z.number().default(10)
      }))
      .query(({ input }) => getUsers(input)),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getUserById(input.id)),
    
    update: publicProcedure
      .input(updateUserInputSchema)
      .mutation(({ input }) => updateUser(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteUser(input.id)),
    
    resetPassword: publicProcedure
      .input(z.object({ 
        id: z.number(), 
        newPassword: z.string().min(6) 
      }))
      .mutation(({ input }) => resetUserPassword(input.id, input.newPassword)),
  }),

  // Category management routes
  categories: router({
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    
    getActive: publicProcedure
      .query(() => getCategories()),
    
    getAll: publicProcedure
      .query(() => getAllCategories()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCategoryById(input.id)),
    
    update: publicProcedure
      .input(updateCategoryInputSchema)
      .mutation(({ input }) => updateCategory(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCategory(input.id)),
  }),

  // Report management routes
  reports: router({
    create: publicProcedure
      .input(createReportInputSchema)
      .mutation(({ input }) => createReport(input)),
    
    getAll: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => getReports(input)),
    
    getByUser: publicProcedure
      .input(z.object({
        userId: z.number(),
        filters: reportFilterSchema.optional()
      }))
      .query(({ input }) => getReportsByUser(input.userId, input.filters)),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getReportById(input.id)),
    
    update: publicProcedure
      .input(updateReportInputSchema.extend({
        userId: z.number()
      }))
      .mutation(({ input }) => updateReport(input, input.userId)),
    
    delete: publicProcedure
      .input(z.object({ 
        id: z.number(), 
        userId: z.number() 
      }))
      .mutation(({ input }) => deleteReport(input.id, input.userId)),
    
    updateStatus: publicProcedure
      .input(z.object({
        reportId: z.number(),
        status: z.enum(['baru', 'proses', 'selesai']),
        notes: z.string().nullable(),
        adminId: z.number()
      }))
      .mutation(({ input }) => updateReportStatus(
        input.reportId, 
        input.status, 
        input.notes, 
        input.adminId
      )),
  }),

  // Progress/timeline routes
  progress: router({
    create: publicProcedure
      .input(createReportProgressInputSchema)
      .mutation(({ input }) => createReportProgress(input)),
    
    getByReport: publicProcedure
      .input(z.object({ reportId: z.number() }))
      .query(({ input }) => getReportProgress(input.reportId)),
    
    addNote: publicProcedure
      .input(z.object({
        reportId: z.number(),
        notes: z.string(),
        adminId: z.number()
      }))
      .mutation(({ input }) => addProgressNote(
        input.reportId, 
        input.notes, 
        input.adminId
      )),
  }),

  // Dashboard routes
  dashboard: router({
    user: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserDashboard(input.userId)),
    
    admin: publicProcedure
      .query(() => getAdminDashboard()),
    
    summary: publicProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categoryId: z.number().optional()
      }))
      .query(({ input }) => getReportsSummary(
        input.dateFrom, 
        input.dateTo, 
        input.categoryId
      )),
  }),

  // Export routes
  export: router({
    reportsCSV: publicProcedure
      .input(reportFilterSchema)
      .query(({ input }) => exportReportsToCSV(input)),
    
    summaryCSV: publicProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categoryId: z.number().optional()
      }))
      .query(({ input }) => exportReportsSummaryToCSV(
        input.dateFrom, 
        input.dateTo, 
        input.categoryId
      )),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`HelpDesk TKA Madrasah TRPC server listening at port: ${port}`);
}

start();