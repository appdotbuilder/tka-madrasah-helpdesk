import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, reportsTable, reportProgressTable } from '../db/schema';
import { type CreateReportProgressInput } from '../schema';
import { createReportProgress, getReportProgress, addProgressNote } from '../handlers/progress';
import { eq } from 'drizzle-orm';

describe('progress handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testAdmin: any;
  let testCategory: any;
  let testReport: any;

  beforeEach(async () => {
    // Create test user (reporter)
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'pelapor',
        is_active: true
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test admin
    const adminResult = await db.insert(usersTable)
      .values({
        username: 'testadmin',
        name: 'Test Admin',
        email: 'admin@example.com',
        password_hash: 'hashed_password',
        role: 'admin',
        is_active: true
      })
      .returning()
      .execute();
    testAdmin = adminResult[0];

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing',
        is_active: true
      })
      .returning()
      .execute();
    testCategory = categoryResult[0];

    // Create test report
    const reportResult = await db.insert(reportsTable)
      .values({
        npsn: '12345678',
        school_name: 'Test School',
        category_id: testCategory.id,
        issue_description: 'Test issue description for progress tracking',
        nisn: '1234567890',
        status: 'baru',
        reporter_id: testUser.id
      })
      .returning()
      .execute();
    testReport = reportResult[0];
  });

  describe('createReportProgress', () => {
    it('should create a progress entry with admin', async () => {
      const input: CreateReportProgressInput = {
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'proses',
        notes: 'Progress update from admin'
      };

      const result = await createReportProgress(input);

      expect(result.report_id).toBe(testReport.id);
      expect(result.admin_id).toBe(testAdmin.id);
      expect(result.status).toBe('proses');
      expect(result.notes).toBe('Progress update from admin');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a progress entry without admin (system generated)', async () => {
      const input: CreateReportProgressInput = {
        report_id: testReport.id,
        admin_id: null,
        status: 'baru',
        notes: 'Initial report submission'
      };

      const result = await createReportProgress(input);

      expect(result.report_id).toBe(testReport.id);
      expect(result.admin_id).toBeNull();
      expect(result.status).toBe('baru');
      expect(result.notes).toBe('Initial report submission');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a progress entry with null notes', async () => {
      const input: CreateReportProgressInput = {
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'selesai',
        notes: null
      };

      const result = await createReportProgress(input);

      expect(result.report_id).toBe(testReport.id);
      expect(result.admin_id).toBe(testAdmin.id);
      expect(result.status).toBe('selesai');
      expect(result.notes).toBeNull();
    });

    it('should save progress entry to database', async () => {
      const input: CreateReportProgressInput = {
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'proses',
        notes: 'Database test progress'
      };

      const result = await createReportProgress(input);

      const progressEntries = await db.select()
        .from(reportProgressTable)
        .where(eq(reportProgressTable.id, result.id))
        .execute();

      expect(progressEntries).toHaveLength(1);
      expect(progressEntries[0].report_id).toBe(testReport.id);
      expect(progressEntries[0].admin_id).toBe(testAdmin.id);
      expect(progressEntries[0].status).toBe('proses');
      expect(progressEntries[0].notes).toBe('Database test progress');
    });
  });

  describe('getReportProgress', () => {
    it('should return empty array for report with no progress', async () => {
      const result = await getReportProgress(testReport.id);
      expect(result).toEqual([]);
    });

    it('should return progress entries for report', async () => {
      // Create multiple progress entries
      await createReportProgress({
        report_id: testReport.id,
        admin_id: null,
        status: 'baru',
        notes: 'Initial submission'
      });

      await createReportProgress({
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'proses',
        notes: 'Under review'
      });

      await createReportProgress({
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'selesai',
        notes: 'Issue resolved'
      });

      const result = await getReportProgress(testReport.id);

      expect(result).toHaveLength(3);
      // Should be ordered by created_at DESC (latest first)
      expect(result[0].status).toBe('selesai');
      expect(result[0].notes).toBe('Issue resolved');
      expect(result[1].status).toBe('proses');
      expect(result[1].notes).toBe('Under review');
      expect(result[2].status).toBe('baru');
      expect(result[2].notes).toBe('Initial submission');
    });

    it('should return only progress for specific report', async () => {
      // Create another report
      const anotherReport = await db.insert(reportsTable)
        .values({
          npsn: '87654321',
          school_name: 'Another School',
          category_id: testCategory.id,
          issue_description: 'Another issue',
          nisn: null,
          status: 'baru',
          reporter_id: testUser.id
        })
        .returning()
        .execute();

      // Create progress for both reports
      await createReportProgress({
        report_id: testReport.id,
        admin_id: testAdmin.id,
        status: 'proses',
        notes: 'First report progress'
      });

      await createReportProgress({
        report_id: anotherReport[0].id,
        admin_id: testAdmin.id,
        status: 'selesai',
        notes: 'Second report progress'
      });

      const result = await getReportProgress(testReport.id);

      expect(result).toHaveLength(1);
      expect(result[0].report_id).toBe(testReport.id);
      expect(result[0].notes).toBe('First report progress');
    });

    it('should handle non-existent report gracefully', async () => {
      const result = await getReportProgress(99999);
      expect(result).toEqual([]);
    });
  });

  describe('addProgressNote', () => {
    it('should add progress note with current report status', async () => {
      // Update report status to 'proses'
      await db.update(reportsTable)
        .set({ status: 'proses' })
        .where(eq(reportsTable.id, testReport.id))
        .execute();

      const result = await addProgressNote(
        testReport.id,
        'Additional progress note',
        testAdmin.id
      );

      expect(result.report_id).toBe(testReport.id);
      expect(result.admin_id).toBe(testAdmin.id);
      expect(result.status).toBe('proses'); // Should match current report status
      expect(result.notes).toBe('Additional progress note');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should preserve report status when adding note', async () => {
      // Set report status to 'selesai'
      await db.update(reportsTable)
        .set({ status: 'selesai' })
        .where(eq(reportsTable.id, testReport.id))
        .execute();

      const result = await addProgressNote(
        testReport.id,
        'Final note after completion',
        testAdmin.id
      );

      expect(result.status).toBe('selesai');
      expect(result.notes).toBe('Final note after completion');

      // Verify report status hasn't changed
      const reports = await db.select()
        .from(reportsTable)
        .where(eq(reportsTable.id, testReport.id))
        .execute();

      expect(reports[0].status).toBe('selesai');
    });

    it('should save progress note to database', async () => {
      const result = await addProgressNote(
        testReport.id,
        'Database test note',
        testAdmin.id
      );

      const progressEntries = await db.select()
        .from(reportProgressTable)
        .where(eq(reportProgressTable.id, result.id))
        .execute();

      expect(progressEntries).toHaveLength(1);
      expect(progressEntries[0].notes).toBe('Database test note');
      expect(progressEntries[0].admin_id).toBe(testAdmin.id);
    });

    it('should throw error for non-existent report', async () => {
      await expect(
        addProgressNote(99999, 'Note for non-existent report', testAdmin.id)
      ).rejects.toThrow(/report not found/i);
    });

    it('should work with different report statuses', async () => {
      const statuses = ['baru', 'proses', 'selesai'] as const;

      for (const status of statuses) {
        await db.update(reportsTable)
          .set({ status })
          .where(eq(reportsTable.id, testReport.id))
          .execute();

        const result = await addProgressNote(
          testReport.id,
          `Note for ${status} status`,
          testAdmin.id
        );

        expect(result.status).toBe(status);
        expect(result.notes).toBe(`Note for ${status} status`);
      }
    });
  });
});