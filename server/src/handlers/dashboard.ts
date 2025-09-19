import { db } from '../db';
import { reportsTable, categoriesTable } from '../db/schema';
import { 
  type UserDashboard, 
  type AdminDashboard 
} from '../schema';
import { eq, count, sql, and, gte, lte } from 'drizzle-orm';

// Get dashboard data for regular user (pelapor)
export const getUserDashboard = async (userId: number): Promise<UserDashboard> => {
  try {
    // Get total reports for user
    const totalResult = await db
      .select({ count: count() })
      .from(reportsTable)
      .where(eq(reportsTable.reporter_id, userId))
      .execute();

    // Get reports by status for user
    const statusCounts = await db
      .select({
        status: reportsTable.status,
        count: count()
      })
      .from(reportsTable)
      .where(eq(reportsTable.reporter_id, userId))
      .groupBy(reportsTable.status)
      .execute();

    // Initialize counts
    let newReports = 0;
    let inProgressReports = 0;
    let completedReports = 0;

    // Map status counts
    statusCounts.forEach(item => {
      switch (item.status) {
        case 'baru':
          newReports = item.count;
          break;
        case 'proses':
          inProgressReports = item.count;
          break;
        case 'selesai':
          completedReports = item.count;
          break;
      }
    });

    return {
      total_reports: totalResult[0]?.count || 0,
      new_reports: newReports,
      in_progress_reports: inProgressReports,
      completed_reports: completedReports
    };
  } catch (error) {
    console.error('User dashboard query failed:', error);
    throw error;
  }
};

// Get dashboard data for admin
export const getAdminDashboard = async (): Promise<AdminDashboard> => {
  try {
    // Get total reports
    const totalResult = await db
      .select({ count: count() })
      .from(reportsTable)
      .execute();

    // Get reports by status
    const statusCounts = await db
      .select({
        status: reportsTable.status,
        count: count()
      })
      .from(reportsTable)
      .groupBy(reportsTable.status)
      .execute();

    // Get reports by category
    const categoryCounts = await db
      .select({
        category_name: categoriesTable.name,
        count: count()
      })
      .from(reportsTable)
      .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
      .groupBy(categoriesTable.name)
      .execute();

    // Get reports by month (last 12 months)
    const monthlyReports = await db
      .select({
        month: sql<string>`to_char(${reportsTable.created_at}, 'YYYY-MM')`,
        count: count()
      })
      .from(reportsTable)
      .where(gte(reportsTable.created_at, sql`current_date - interval '12 months'`))
      .groupBy(sql`to_char(${reportsTable.created_at}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${reportsTable.created_at}, 'YYYY-MM')`)
      .execute();

    // Initialize status counts
    let newReports = 0;
    let inProgressReports = 0;
    let completedReports = 0;

    // Map status counts
    statusCounts.forEach(item => {
      switch (item.status) {
        case 'baru':
          newReports = item.count;
          break;
        case 'proses':
          inProgressReports = item.count;
          break;
        case 'selesai':
          completedReports = item.count;
          break;
      }
    });

    return {
      total_reports: totalResult[0]?.count || 0,
      new_reports: newReports,
      in_progress_reports: inProgressReports,
      completed_reports: completedReports,
      reports_by_category: categoryCounts.map(item => ({
        category_name: item.category_name,
        count: item.count
      })),
      reports_by_month: monthlyReports.map(item => ({
        month: item.month,
        count: item.count
      }))
    };
  } catch (error) {
    console.error('Admin dashboard query failed:', error);
    throw error;
  }
};

// Get reports summary for date range (used in reports)
export const getReportsSummary = async (
  dateFrom?: string, 
  dateTo?: string,
  categoryId?: number
): Promise<{
  total: number;
  by_status: { status: string; count: number }[];
  by_category: { category_name: string; count: number }[];
  by_month: { month: string; count: number }[];
}> => {
  try {
    // Build conditions array
    const conditions = [];
    
    if (dateFrom) {
      conditions.push(gte(reportsTable.created_at, new Date(dateFrom)));
    }
    
    if (dateTo) {
      // Add one day to dateTo to include the entire day
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(reportsTable.created_at, endDate));
    }
    
    if (categoryId) {
      conditions.push(eq(reportsTable.category_id, categoryId));
    }

    // Base query condition
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(reportsTable)
      .where(whereClause)
      .execute();

    // Get status counts
    const statusCounts = await db
      .select({
        status: reportsTable.status,
        count: count()
      })
      .from(reportsTable)
      .where(whereClause)
      .groupBy(reportsTable.status)
      .execute();

    // Get category counts
    const categoryCounts = await db
      .select({
        category_name: categoriesTable.name,
        count: count()
      })
      .from(reportsTable)
      .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
      .where(whereClause)
      .groupBy(categoriesTable.name)
      .execute();

    // Get monthly counts
    const monthlyReports = await db
      .select({
        month: sql<string>`to_char(${reportsTable.created_at}, 'YYYY-MM')`,
        count: count()
      })
      .from(reportsTable)
      .where(whereClause)
      .groupBy(sql`to_char(${reportsTable.created_at}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${reportsTable.created_at}, 'YYYY-MM')`)
      .execute();

    return {
      total: totalResult[0]?.count || 0,
      by_status: statusCounts.map(item => ({
        status: item.status,
        count: item.count
      })),
      by_category: categoryCounts.map(item => ({
        category_name: item.category_name,
        count: item.count
      })),
      by_month: monthlyReports.map(item => ({
        month: item.month,
        count: item.count
      }))
    };
  } catch (error) {
    console.error('Reports summary query failed:', error);
    throw error;
  }
};