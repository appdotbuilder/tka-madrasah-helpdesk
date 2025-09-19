import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  role: z.enum(['pelapor', 'admin']),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Report schema
export const reportSchema = z.object({
  id: z.number(),
  npsn: z.string(),
  school_name: z.string(),
  category_id: z.number(),
  issue_description: z.string(),
  nisn: z.string().nullable(),
  status: z.enum(['baru', 'proses', 'selesai']),
  reporter_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Report = z.infer<typeof reportSchema>;

// Report progress schema for timeline/updates
export const reportProgressSchema = z.object({
  id: z.number(),
  report_id: z.number(),
  admin_id: z.number().nullable(),
  status: z.enum(['baru', 'proses', 'selesai']),
  notes: z.string().nullable(),
  created_at: z.coerce.date()
});

export type ReportProgress = z.infer<typeof reportProgressSchema>;

// Input schemas for creating/updating entities

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['pelapor', 'admin']),
  is_active: z.boolean().default(true)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).optional(),
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['pelapor', 'admin']).optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Login input schema
export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Category input schemas
export const createCategoryInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable(),
  is_active: z.boolean().default(true)
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Report input schemas
export const createReportInputSchema = z.object({
  npsn: z.string().regex(/^\d{8}$/, "NPSN harus 8 digit angka"),
  school_name: z.string().min(2),
  category_id: z.number(),
  issue_description: z.string().min(10),
  nisn: z.string().regex(/^\d{10}$/, "NISN harus 10 digit angka").nullable(),
  reporter_id: z.number()
});

export type CreateReportInput = z.infer<typeof createReportInputSchema>;

export const updateReportInputSchema = z.object({
  id: z.number(),
  npsn: z.string().regex(/^\d{8}$/, "NPSN harus 8 digit angka").optional(),
  school_name: z.string().min(2).optional(),
  category_id: z.number().optional(),
  issue_description: z.string().min(10).optional(),
  nisn: z.string().regex(/^\d{10}$/, "NISN harus 10 digit angka").nullable().optional(),
  status: z.enum(['baru', 'proses', 'selesai']).optional()
});

export type UpdateReportInput = z.infer<typeof updateReportInputSchema>;

// Report progress input schema
export const createReportProgressInputSchema = z.object({
  report_id: z.number(),
  admin_id: z.number().nullable(),
  status: z.enum(['baru', 'proses', 'selesai']),
  notes: z.string().nullable()
});

export type CreateReportProgressInput = z.infer<typeof createReportProgressInputSchema>;

// Filter schemas for queries
export const reportFilterSchema = z.object({
  status: z.enum(['baru', 'proses', 'selesai']).optional(),
  category_id: z.number().optional(),
  reporter_id: z.number().optional(),
  npsn: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(10)
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

// Dashboard response schemas
export const userDashboardSchema = z.object({
  total_reports: z.number(),
  new_reports: z.number(),
  in_progress_reports: z.number(),
  completed_reports: z.number()
});

export type UserDashboard = z.infer<typeof userDashboardSchema>;

export const adminDashboardSchema = z.object({
  total_reports: z.number(),
  new_reports: z.number(),
  in_progress_reports: z.number(),
  completed_reports: z.number(),
  reports_by_category: z.array(z.object({
    category_name: z.string(),
    count: z.number()
  })),
  reports_by_month: z.array(z.object({
    month: z.string(),
    count: z.number()
  }))
});

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

// Report with relations schema
export const reportWithRelationsSchema = z.object({
  id: z.number(),
  npsn: z.string(),
  school_name: z.string(),
  category_id: z.number(),
  category_name: z.string(),
  issue_description: z.string(),
  nisn: z.string().nullable(),
  status: z.enum(['baru', 'proses', 'selesai']),
  reporter_id: z.number(),
  reporter_name: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  progress: z.array(reportProgressSchema).optional()
});

export type ReportWithRelations = z.infer<typeof reportWithRelationsSchema>;

// Pagination response schema
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    total_pages: z.number()
  });

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};