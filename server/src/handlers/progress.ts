import { db } from '../db';
import { reportProgressTable, reportsTable } from '../db/schema';
import { 
  type CreateReportProgressInput, 
  type ReportProgress 
} from '../schema';
import { eq, desc } from 'drizzle-orm';

// Create report progress entry
export const createReportProgress = async (input: CreateReportProgressInput): Promise<ReportProgress> => {
  try {
    const result = await db.insert(reportProgressTable)
      .values({
        report_id: input.report_id,
        admin_id: input.admin_id,
        status: input.status,
        notes: input.notes
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Report progress creation failed:', error);
    throw error;
  }
};

// Get progress timeline for a report
export const getReportProgress = async (reportId: number): Promise<ReportProgress[]> => {
  try {
    const results = await db.select()
      .from(reportProgressTable)
      .where(eq(reportProgressTable.report_id, reportId))
      .orderBy(desc(reportProgressTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Report progress fetch failed:', error);
    throw error;
  }
};

// Add progress note to existing report
export const addProgressNote = async (
  reportId: number, 
  notes: string, 
  adminId: number
): Promise<ReportProgress> => {
  try {
    // First, get the current status of the report
    const reportResult = await db.select({ status: reportsTable.status })
      .from(reportsTable)
      .where(eq(reportsTable.id, reportId))
      .execute();

    if (reportResult.length === 0) {
      throw new Error('Report not found');
    }

    const currentStatus = reportResult[0].status;

    // Create progress entry with current status and notes
    const result = await db.insert(reportProgressTable)
      .values({
        report_id: reportId,
        admin_id: adminId,
        status: currentStatus,
        notes: notes
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Progress note addition failed:', error);
    throw error;
  }
};