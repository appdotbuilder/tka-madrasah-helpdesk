import { db } from '../db';
import { reportsTable, categoriesTable, usersTable } from '../db/schema';
import { type ReportFilter } from '../schema';
import { eq, and, gte, lte, ilike, sql, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// Helper function to escape CSV fields
const escapeCSVField = (field: string | null | undefined): string => {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

// Helper function to format date for CSV
const formatDateForCSV = (date: Date): string => {
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

// Export reports to CSV
export const exportReportsToCSV = async (filters: ReportFilter): Promise<string> => {
  try {
    // Build conditions array
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
      // Set to end of day
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(reportsTable.created_at, toDate));
    }

    if (filters.search) {
      conditions.push(
        ilike(reportsTable.school_name, `%${filters.search}%`)
      );
    }

    // Build and execute query
    const baseQuery = db.select({
      id: reportsTable.id,
      npsn: reportsTable.npsn,
      school_name: reportsTable.school_name,
      issue_description: reportsTable.issue_description,
      nisn: reportsTable.nisn,
      status: reportsTable.status,
      created_at: reportsTable.created_at,
      updated_at: reportsTable.updated_at,
      category_name: categoriesTable.name,
      reporter_name: usersTable.name
    })
    .from(reportsTable)
    .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
    .innerJoin(usersTable, eq(reportsTable.reporter_id, usersTable.id));

    const results = conditions.length > 0 
      ? await baseQuery.where(and(...conditions)).orderBy(desc(reportsTable.created_at)).execute()
      : await baseQuery.orderBy(desc(reportsTable.created_at)).execute();

    // Build CSV content
    const headers = [
      'ID',
      'NPSN',
      'Nama Madrasah',
      'Kategori',
      'Deskripsi Masalah',
      'NISN',
      'Status',
      'Pelapor',
      'Tanggal Dibuat',
      'Tanggal Diperbarui'
    ];

    let csv = headers.join(',') + '\n';

    for (const report of results) {
      const row = [
        escapeCSVField(String(report.id)),
        escapeCSVField(report.npsn),
        escapeCSVField(report.school_name),
        escapeCSVField(report.category_name),
        escapeCSVField(report.issue_description),
        escapeCSVField(report.nisn),
        escapeCSVField(report.status),
        escapeCSVField(report.reporter_name),
        escapeCSVField(formatDateForCSV(report.created_at)),
        escapeCSVField(formatDateForCSV(report.updated_at))
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  } catch (error) {
    console.error('Export reports to CSV failed:', error);
    throw error;
  }
};

// Export reports summary to CSV
export const exportReportsSummaryToCSV = async (
  dateFrom?: string, 
  dateTo?: string,
  categoryId?: number
): Promise<string> => {
  try {
    const conditions: SQL<unknown>[] = [];

    // Build date conditions
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      conditions.push(gte(reportsTable.created_at, fromDate));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(reportsTable.created_at, toDate));
    }

    if (categoryId) {
      conditions.push(eq(reportsTable.category_id, categoryId));
    }

    // Get reports by status summary
    const statusBaseQuery = db.select({
      status: reportsTable.status,
      count: count(reportsTable.id)
    })
    .from(reportsTable)
    .groupBy(reportsTable.status);

    const statusSummary = conditions.length > 0 
      ? await statusBaseQuery.where(and(...conditions)).execute()
      : await statusBaseQuery.execute();

    // Get reports by category summary
    const categoryBaseQuery = db.select({
      category_name: categoriesTable.name,
      count: count(reportsTable.id)
    })
    .from(reportsTable)
    .innerJoin(categoriesTable, eq(reportsTable.category_id, categoriesTable.id))
    .groupBy(categoriesTable.name);

    const categorySummary = conditions.length > 0 
      ? await categoryBaseQuery.where(and(...conditions)).execute()
      : await categoryBaseQuery.execute();

    // Get monthly reports summary
    const monthlyBaseQuery = db.select({
      month: sql<string>`TO_CHAR(${reportsTable.created_at}, 'YYYY-MM')`.as('month'),
      count: count(reportsTable.id)
    })
    .from(reportsTable)
    .groupBy(sql`TO_CHAR(${reportsTable.created_at}, 'YYYY-MM')`);

    const monthlySummary = conditions.length > 0 
      ? await monthlyBaseQuery.where(and(...conditions)).orderBy(sql`TO_CHAR(${reportsTable.created_at}, 'YYYY-MM')`).execute()
      : await monthlyBaseQuery.orderBy(sql`TO_CHAR(${reportsTable.created_at}, 'YYYY-MM')`).execute();

    // Build CSV content
    let csv = 'Ringkasan,Jumlah\n';

    // Add status summary
    csv += '\nRingkasan per Status,\n';
    for (const item of statusSummary) {
      csv += `${escapeCSVField(item.status)},${item.count}\n`;
    }

    // Add category summary
    csv += '\nRingkasan per Kategori,\n';
    for (const item of categorySummary) {
      csv += `${escapeCSVField(item.category_name)},${item.count}\n`;
    }

    // Add monthly summary
    csv += '\nRingkasan per Bulan,\n';
    for (const item of monthlySummary) {
      csv += `${escapeCSVField(item.month)},${item.count}\n`;
    }

    // Add total summary
    const totalReports = statusSummary.reduce((sum, item) => sum + item.count, 0);
    csv += `\nTotal Laporan,${totalReports}\n`;

    return csv;
  } catch (error) {
    console.error('Export reports summary to CSV failed:', error);
    throw error;
  }
};