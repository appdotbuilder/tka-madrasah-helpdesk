import { db } from '../db';
import { 
  reportsTable, 
  reportProgressTable, 
  categoriesTable, 
  usersTable 
} from '../db/schema';
import { 
  type CreateReportInput, 
  type UpdateReportInput, 
  type Report, 
  type ReportWithRelations,
  type ReportFilter,
  type PaginatedResponse 
} from '../schema';
import { eq, and, desc, asc, ilike, gte, lte, SQL, count, or } from 'drizzle-orm';

// Create a new report
export const createReport = async (input: CreateReportInput): Promise<Report> => {
  try {
    // Verify foreign key constraints exist
    const category = await db.select()
      .from(categoriesTable)
      .where(and(eq(categoriesTable.id, input.category_id), eq(categoriesTable.is_active, true)))
      .limit(1)
      .execute();
    
    if (category.length === 0) {
      throw new Error('Category not found or inactive');
    }

    const reporter = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.id, input.reporter_id), eq(usersTable.is_active, true)))
      .limit(1)
      .execute();
    
    if (reporter.length === 0) {
      throw new Error('Reporter not found or inactive');
    }

    // Insert report
    const result = await db.insert(reportsTable)
      .values({
        npsn: input.npsn,
        school_name: input.school_name,
        category_id: input.category_id,
        issue_description: input.issue_description,
        nisn: input.nisn,
        status: 'baru',
        reporter_id: input.reporter_id
      })
      .returning()
      .execute();

    const report = result[0];

    // Create initial progress entry
    await db.insert(reportProgressTable)
      .values({
        report_id: report.id,
        admin_id: null,
        status: 'baru',
        notes: 'Laporan dibuat'
      })
      .execute();

    return report;
  } catch (error) {
    console.error('Report creation failed:', error);
    throw error;
  }
};

// Get reports with filtering, search and pagination
export const getReports = async (filters: ReportFilter): Promise<PaginatedResponse<ReportWithRelations>> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters.status) {
      conditions.push(eq(reportsTable.status, filters.status));
    }

    if (filters.category_id) {
      conditions.push(eq(reportsTable.category_id, filters.category_id));
    }

    if (filters.reporter_id) {
      conditions.push(eq(reportsTable.reporter_id, filters.reporter_id));
    }

    if (filters.npsn) {
      conditions.push(eq(reportsTable.npsn, filters.npsn));
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      conditions.push(gte(reportsTable.created_at, fromDate));
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      conditions.push(lte(reportsTable.created_at, toDate));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(reportsTable.school_name, `%${filters.search}%`),
          ilike(reportsTable.npsn, `%${filters.search}%`),
          ilike(reportsTable.issue_description, `%${filters.search}%`)
        )!
      );
    }

    // Build and execute main query
    const offset = (filters.page - 1) * filters.limit;
    const whereClause = conditions.length === 0 ? undefined : 
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const results = await db.select({
      id: reportsTable.id,
      npsn: reportsTable.npsn,
      school_name: reportsTable.school_name,
      category_id: reportsTable.category_id,
      category_name: categoriesTable.name,
      issue_description: reportsTable.issue_description,
      nisn: reportsTable.nisn,
      status: reportsTable.status,
      reporter_id: reportsTable.reporter_id,
      reporter_name: usersTable.name,
      created_at: reportsTable.created_at,
      updated_at: reportsTable.updated_at
    })
    .from(reportsTable)
    .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
    .innerJoin(usersTable, eq(reportsTable.reporter_id, usersTable.id))
    .where(whereClause)
    .orderBy(desc(reportsTable.created_at))
    .limit(filters.limit)
    .offset(offset)
    .execute();

    // Count query for pagination
    const countResult = await db.select({ count: count() })
      .from(reportsTable)
      .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
      .innerJoin(usersTable, eq(reportsTable.reporter_id, usersTable.id))
      .where(whereClause)
      .execute();

    const total = countResult[0].count;
    const total_pages = Math.ceil(total / filters.limit);

    // Format results
    const data: ReportWithRelations[] = results.map(row => ({
      id: row.id,
      npsn: row.npsn,
      school_name: row.school_name,
      category_id: row.category_id,
      category_name: row.category_name,
      issue_description: row.issue_description,
      nisn: row.nisn,
      status: row.status,
      reporter_id: row.reporter_id,
      reporter_name: row.reporter_name,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return {
      data,
      total,
      page: filters.page,
      limit: filters.limit,
      total_pages
    };
  } catch (error) {
    console.error('Get reports failed:', error);
    throw error;
  }
};

// Get reports by user (for pelapor dashboard)
export const getReportsByUser = async (userId: number, filters?: Partial<ReportFilter>): Promise<PaginatedResponse<ReportWithRelations>> => {
  try {
    const fullFilters: ReportFilter = {
      status: filters?.status,
      category_id: filters?.category_id,
      reporter_id: userId, // Force filter by user ID
      npsn: filters?.npsn,
      date_from: filters?.date_from,
      date_to: filters?.date_to,
      search: filters?.search,
      page: filters?.page || 1,
      limit: filters?.limit || 10
    };

    return await getReports(fullFilters);
  } catch (error) {
    console.error('Get reports by user failed:', error);
    throw error;
  }
};

// Get report by ID with full details and progress timeline
export const getReportById = async (id: number): Promise<ReportWithRelations | null> => {
  try {
    // Get report with relations
    const reportResult = await db.select({
      id: reportsTable.id,
      npsn: reportsTable.npsn,
      school_name: reportsTable.school_name,
      category_id: reportsTable.category_id,
      category_name: categoriesTable.name,
      issue_description: reportsTable.issue_description,
      nisn: reportsTable.nisn,
      status: reportsTable.status,
      reporter_id: reportsTable.reporter_id,
      reporter_name: usersTable.name,
      created_at: reportsTable.created_at,
      updated_at: reportsTable.updated_at
    })
    .from(reportsTable)
    .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
    .innerJoin(usersTable, eq(reportsTable.reporter_id, usersTable.id))
    .where(eq(reportsTable.id, id))
    .limit(1)
    .execute();

    if (reportResult.length === 0) {
      return null;
    }

    const reportData = reportResult[0];

    // Get progress timeline
    const progressResult = await db.select({
      id: reportProgressTable.id,
      report_id: reportProgressTable.report_id,
      admin_id: reportProgressTable.admin_id,
      status: reportProgressTable.status,
      notes: reportProgressTable.notes,
      created_at: reportProgressTable.created_at
    })
    .from(reportProgressTable)
    .where(eq(reportProgressTable.report_id, id))
    .orderBy(asc(reportProgressTable.created_at))
    .execute();

    return {
      id: reportData.id,
      npsn: reportData.npsn,
      school_name: reportData.school_name,
      category_id: reportData.category_id,
      category_name: reportData.category_name,
      issue_description: reportData.issue_description,
      nisn: reportData.nisn,
      status: reportData.status,
      reporter_id: reportData.reporter_id,
      reporter_name: reportData.reporter_name,
      created_at: reportData.created_at,
      updated_at: reportData.updated_at,
      progress: progressResult
    };
  } catch (error) {
    console.error('Get report by ID failed:', error);
    throw error;
  }
};

// Update report (for users - limited to own reports with 'baru' status)
export const updateReport = async (input: UpdateReportInput, userId: number): Promise<Report> => {
  try {
    // Verify report exists and user owns it
    const existingReport = await db.select()
      .from(reportsTable)
      .where(and(eq(reportsTable.id, input.id), eq(reportsTable.reporter_id, userId)))
      .limit(1)
      .execute();

    if (existingReport.length === 0) {
      throw new Error('Report not found or access denied');
    }

    const report = existingReport[0];

    // Only allow updates to reports with 'baru' status
    if (report.status !== 'baru') {
      throw new Error('Can only update reports with status "baru"');
    }

    // Verify category exists if being updated
    if (input.category_id) {
      const category = await db.select()
        .from(categoriesTable)
        .where(and(eq(categoriesTable.id, input.category_id), eq(categoriesTable.is_active, true)))
        .limit(1)
        .execute();
      
      if (category.length === 0) {
        throw new Error('Category not found or inactive');
      }
    }

    // Update report
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.npsn) updateValues.npsn = input.npsn;
    if (input.school_name) updateValues.school_name = input.school_name;
    if (input.category_id) updateValues.category_id = input.category_id;
    if (input.issue_description) updateValues.issue_description = input.issue_description;
    if (input.nisn !== undefined) updateValues.nisn = input.nisn;

    const result = await db.update(reportsTable)
      .set(updateValues)
      .where(eq(reportsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Report update failed:', error);
    throw error;
  }
};

// Delete report (only own reports with 'baru' status)
export const deleteReport = async (id: number, userId: number): Promise<boolean> => {
  try {
    // Verify report exists and user owns it
    const existingReport = await db.select()
      .from(reportsTable)
      .where(and(eq(reportsTable.id, id), eq(reportsTable.reporter_id, userId)))
      .limit(1)
      .execute();

    if (existingReport.length === 0) {
      throw new Error('Report not found or access denied');
    }

    const report = existingReport[0];

    // Only allow deletion of reports with 'baru' status
    if (report.status !== 'baru') {
      throw new Error('Can only delete reports with status "baru"');
    }

    // Delete progress entries first
    await db.delete(reportProgressTable)
      .where(eq(reportProgressTable.report_id, id))
      .execute();

    // Delete report
    await db.delete(reportsTable)
      .where(eq(reportsTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Report deletion failed:', error);
    throw error;
  }
};

// Update report status (admin only)
export const updateReportStatus = async (
  reportId: number, 
  status: 'baru' | 'proses' | 'selesai', 
  notes: string | null, 
  adminId: number
): Promise<Report> => {
  try {
    // Verify report exists
    const existingReport = await db.select()
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .limit(1)
      .execute();

    if (existingReport.length === 0) {
      throw new Error('Report not found');
    }

    // Verify admin exists
    const admin = await db.select()
      .from(usersTable)
      .where(and(eq(usersTable.id, adminId), eq(usersTable.role, 'admin'), eq(usersTable.is_active, true)))
      .limit(1)
      .execute();

    if (admin.length === 0) {
      throw new Error('Admin not found or inactive');
    }

    // Update report status
    const result = await db.update(reportsTable)
      .set({
        status,
        updated_at: new Date()
      })
      .where(eq(reportsTable.id, reportId))
      .returning()
      .execute();

    // Create progress entry
    await db.insert(reportProgressTable)
      .values({
        report_id: reportId,
        admin_id: adminId,
        status,
        notes
      })
      .execute();

    return result[0];
  } catch (error) {
    console.error('Report status update failed:', error);
    throw error;
  }
};