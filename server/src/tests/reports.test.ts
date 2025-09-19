import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, reportsTable, reportProgressTable } from '../db/schema';
import { 
  type CreateReportInput, 
  type UpdateReportInput,
  type ReportFilter 
} from '../schema';
import {
  createReport,
  getReports,
  getReportsByUser,
  getReportById,
  updateReport,
  deleteReport,
  updateReportStatus
} from '../handlers/reports';
import { eq } from 'drizzle-orm';

describe('Reports Handler', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helpers
  const createTestUser = async (role: 'pelapor' | 'admin' = 'pelapor') => {
    const result = await db.insert(usersTable)
      .values({
        username: `testuser_${Math.random()}`,
        name: 'Test User',
        email: `test_${Math.random()}@example.com`,
        password_hash: 'hashedpassword',
        role,
        is_active: true
      })
      .returning()
      .execute();
    return result[0];
  };

  const createTestCategory = async () => {
    const result = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description',
        is_active: true
      })
      .returning()
      .execute();
    return result[0];
  };

  const testReportInput: CreateReportInput = {
    npsn: '12345678',
    school_name: 'Test School',
    category_id: 1,
    issue_description: 'This is a test issue description for testing purposes',
    nisn: '1234567890',
    reporter_id: 1
  };

  describe('createReport', () => {
    it('should create a report successfully', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const input: CreateReportInput = {
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      };

      const result = await createReport(input);

      expect(result.npsn).toEqual('12345678');
      expect(result.school_name).toEqual('Test School');
      expect(result.category_id).toEqual(category.id);
      expect(result.issue_description).toEqual('This is a test issue description for testing purposes');
      expect(result.nisn).toEqual('1234567890');
      expect(result.status).toEqual('baru');
      expect(result.reporter_id).toEqual(user.id);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create initial progress entry', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const input: CreateReportInput = {
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      };

      const report = await createReport(input);

      const progressEntries = await db.select()
        .from(reportProgressTable)
        .where(eq(reportProgressTable.report_id, report.id))
        .execute();

      expect(progressEntries).toHaveLength(1);
      expect(progressEntries[0].status).toEqual('baru');
      expect(progressEntries[0].notes).toEqual('Laporan dibuat');
      expect(progressEntries[0].admin_id).toBeNull();
    });

    it('should fail with invalid category', async () => {
      const user = await createTestUser();
      
      const input: CreateReportInput = {
        ...testReportInput,
        category_id: 999, // Non-existent category
        reporter_id: user.id
      };

      await expect(createReport(input)).rejects.toThrow(/Category not found/i);
    });

    it('should fail with invalid reporter', async () => {
      const category = await createTestCategory();
      
      const input: CreateReportInput = {
        ...testReportInput,
        category_id: category.id,
        reporter_id: 999 // Non-existent user
      };

      await expect(createReport(input)).rejects.toThrow(/Reporter not found/i);
    });
  });

  describe('getReports', () => {
    it('should return paginated reports with relations', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      // Create test reports
      await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const filters: ReportFilter = {
        page: 1,
        limit: 10
      };

      const result = await getReports(filters);

      expect(result.data).toHaveLength(1);
      expect(result.total).toEqual(1);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(10);
      expect(result.total_pages).toEqual(1);

      const report = result.data[0];
      expect(report.category_name).toEqual('Test Category');
      expect(report.reporter_name).toEqual('Test User');
    });

    it('should filter reports by status', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      // Create reports with different statuses
      const report1 = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      // Update one report to 'proses'
      await db.update(reportsTable)
        .set({ status: 'proses' })
        .where(eq(reportsTable.id, report1.id))
        .execute();

      await createReport({
        ...testReportInput,
        npsn: '87654321',
        category_id: category.id,
        reporter_id: user.id
      });

      const filters: ReportFilter = {
        status: 'baru',
        page: 1,
        limit: 10
      };

      const result = await getReports(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toEqual('baru');
      expect(result.data[0].npsn).toEqual('87654321');
    });

    it('should search reports by school name', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      await createReport({
        ...testReportInput,
        school_name: 'Special Search School',
        category_id: category.id,
        reporter_id: user.id
      });

      await createReport({
        ...testReportInput,
        npsn: '87654321',
        school_name: 'Another School',
        category_id: category.id,
        reporter_id: user.id
      });

      const filters: ReportFilter = {
        search: 'Special',
        page: 1,
        limit: 10
      };

      const result = await getReports(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].school_name).toEqual('Special Search School');
    });

    it('should filter reports by date range', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const filters: ReportFilter = {
        date_from: yesterday.toISOString(),
        date_to: tomorrow.toISOString(),
        page: 1,
        limit: 10
      };

      const result = await getReports(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].created_at).toBeInstanceOf(Date);
    });
  });

  describe('getReportsByUser', () => {
    it('should return reports for specific user only', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const category = await createTestCategory();
      
      await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user1.id
      });

      await createReport({
        ...testReportInput,
        npsn: '87654321',
        category_id: category.id,
        reporter_id: user2.id
      });

      const result = await getReportsByUser(user1.id);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].reporter_id).toEqual(user1.id);
      expect(result.data[0].npsn).toEqual('12345678');
    });
  });

  describe('getReportById', () => {
    it('should return report with full details and progress', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const result = await getReportById(report.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(report.id);
      expect(result!.category_name).toEqual('Test Category');
      expect(result!.reporter_name).toEqual('Test User');
      expect(result!.progress).toHaveLength(1);
      expect(result!.progress![0].status).toEqual('baru');
    });

    it('should return null for non-existent report', async () => {
      const result = await getReportById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateReport', () => {
    it('should update report successfully', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const input: UpdateReportInput = {
        id: report.id,
        school_name: 'Updated School Name',
        issue_description: 'Updated issue description for testing'
      };

      const result = await updateReport(input, user.id);

      expect(result.school_name).toEqual('Updated School Name');
      expect(result.issue_description).toEqual('Updated issue description for testing');
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.updated_at.getTime()).toBeGreaterThan(report.updated_at.getTime());
    });

    it('should fail if user does not own report', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user1.id
      });

      const input: UpdateReportInput = {
        id: report.id,
        school_name: 'Updated School Name'
      };

      await expect(updateReport(input, user2.id)).rejects.toThrow(/not found or access denied/i);
    });

    it('should fail if report status is not "baru"', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      // Update status to 'proses'
      await db.update(reportsTable)
        .set({ status: 'proses' })
        .where(eq(reportsTable.id, report.id))
        .execute();

      const input: UpdateReportInput = {
        id: report.id,
        school_name: 'Updated School Name'
      };

      await expect(updateReport(input, user.id)).rejects.toThrow(/Can only update reports with status "baru"/i);
    });
  });

  describe('deleteReport', () => {
    it('should delete report and progress entries', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const result = await deleteReport(report.id, user.id);
      expect(result).toBe(true);

      // Verify report is deleted
      const reports = await db.select()
        .from(reportsTable)
        .where(eq(reportsTable.id, report.id))
        .execute();
      expect(reports).toHaveLength(0);

      // Verify progress entries are deleted
      const progress = await db.select()
        .from(reportProgressTable)
        .where(eq(reportProgressTable.report_id, report.id))
        .execute();
      expect(progress).toHaveLength(0);
    });

    it('should fail if user does not own report', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user1.id
      });

      await expect(deleteReport(report.id, user2.id)).rejects.toThrow(/not found or access denied/i);
    });

    it('should fail if report status is not "baru"', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      // Update status to 'proses'
      await db.update(reportsTable)
        .set({ status: 'proses' })
        .where(eq(reportsTable.id, report.id))
        .execute();

      await expect(deleteReport(report.id, user.id)).rejects.toThrow(/Can only delete reports with status "baru"/i);
    });
  });

  describe('updateReportStatus', () => {
    it('should update report status and create progress entry', async () => {
      const user = await createTestUser();
      const admin = await createTestUser('admin');
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      const result = await updateReportStatus(
        report.id, 
        'proses', 
        'Admin reviewing the report', 
        admin.id
      );

      expect(result.status).toEqual('proses');
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify progress entry was created
      const progressEntries = await db.select()
        .from(reportProgressTable)
        .where(eq(reportProgressTable.report_id, report.id))
        .execute();

      expect(progressEntries).toHaveLength(2); // Initial + new
      const newProgress = progressEntries.find(p => p.status === 'proses');
      expect(newProgress!.admin_id).toEqual(admin.id);
      expect(newProgress!.notes).toEqual('Admin reviewing the report');
    });

    it('should fail with non-existent report', async () => {
      const admin = await createTestUser('admin');

      await expect(updateReportStatus(999, 'proses', 'Notes', admin.id))
        .rejects.toThrow(/Report not found/i);
    });

    it('should fail with non-admin user', async () => {
      const user = await createTestUser();
      const nonAdmin = await createTestUser('pelapor');
      const category = await createTestCategory();
      
      const report = await createReport({
        ...testReportInput,
        category_id: category.id,
        reporter_id: user.id
      });

      await expect(updateReportStatus(report.id, 'proses', 'Notes', nonAdmin.id))
        .rejects.toThrow(/Admin not found/i);
    });
  });
});