import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, reportsTable } from '../db/schema';
import { getUserDashboard, getAdminDashboard, getReportsSummary } from '../handlers/dashboard';

describe('Dashboard handlers', () => {
  let testUser: any;
  let testAdmin: any;
  let testCategory1: any;
  let testCategory2: any;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const users = await db.insert(usersTable).values([
      {
        username: 'testuser',
        name: 'Test User',
        email: 'user@test.com',
        password_hash: 'hashedpass',
        role: 'pelapor',
        is_active: true
      },
      {
        username: 'testadmin',
        name: 'Test Admin',
        email: 'admin@test.com',
        password_hash: 'hashedpass',
        role: 'admin',
        is_active: true
      }
    ]).returning().execute();

    testUser = users[0];
    testAdmin = users[1];

    // Create test categories
    const categories = await db.insert(categoriesTable).values([
      {
        name: 'Technical Issues',
        description: 'Technical problems',
        is_active: true
      },
      {
        name: 'Administrative Issues',
        description: 'Admin problems',
        is_active: true
      }
    ]).returning().execute();

    testCategory1 = categories[0];
    testCategory2 = categories[1];
  });

  afterEach(resetDB);

  describe('getUserDashboard', () => {
    it('should return empty dashboard for user with no reports', async () => {
      const result = await getUserDashboard(testUser.id);

      expect(result.total_reports).toBe(0);
      expect(result.new_reports).toBe(0);
      expect(result.in_progress_reports).toBe(0);
      expect(result.completed_reports).toBe(0);
    });

    it('should count reports by status for specific user', async () => {
      // Create reports with different statuses for test user
      await db.insert(reportsTable).values([
        {
          npsn: '12345678',
          school_name: 'Test School 1',
          category_id: testCategory1.id,
          issue_description: 'Test issue 1',
          nisn: '1234567890',
          status: 'baru',
          reporter_id: testUser.id
        },
        {
          npsn: '12345679',
          school_name: 'Test School 2',
          category_id: testCategory1.id,
          issue_description: 'Test issue 2',
          nisn: null,
          status: 'baru',
          reporter_id: testUser.id
        },
        {
          npsn: '12345680',
          school_name: 'Test School 3',
          category_id: testCategory2.id,
          issue_description: 'Test issue 3',
          nisn: '1234567891',
          status: 'proses',
          reporter_id: testUser.id
        },
        {
          npsn: '12345681',
          school_name: 'Test School 4',
          category_id: testCategory2.id,
          issue_description: 'Test issue 4',
          nisn: null,
          status: 'selesai',
          reporter_id: testUser.id
        }
      ]).execute();

      // Create report for different user (should not be counted)
      await db.insert(reportsTable).values({
        npsn: '12345682',
        school_name: 'Other School',
        category_id: testCategory1.id,
        issue_description: 'Other user issue',
        nisn: null,
        status: 'baru',
        reporter_id: testAdmin.id
      }).execute();

      const result = await getUserDashboard(testUser.id);

      expect(result.total_reports).toBe(4);
      expect(result.new_reports).toBe(2);
      expect(result.in_progress_reports).toBe(1);
      expect(result.completed_reports).toBe(1);
    });

    it('should handle user with only one status type', async () => {
      // Create reports with only 'baru' status
      await db.insert(reportsTable).values([
        {
          npsn: '12345678',
          school_name: 'Test School 1',
          category_id: testCategory1.id,
          issue_description: 'Test issue 1',
          nisn: '1234567890',
          status: 'baru',
          reporter_id: testUser.id
        },
        {
          npsn: '12345679',
          school_name: 'Test School 2',
          category_id: testCategory1.id,
          issue_description: 'Test issue 2',
          nisn: null,
          status: 'baru',
          reporter_id: testUser.id
        }
      ]).execute();

      const result = await getUserDashboard(testUser.id);

      expect(result.total_reports).toBe(2);
      expect(result.new_reports).toBe(2);
      expect(result.in_progress_reports).toBe(0);
      expect(result.completed_reports).toBe(0);
    });
  });

  describe('getAdminDashboard', () => {
    it('should return empty dashboard when no reports exist', async () => {
      const result = await getAdminDashboard();

      expect(result.total_reports).toBe(0);
      expect(result.new_reports).toBe(0);
      expect(result.in_progress_reports).toBe(0);
      expect(result.completed_reports).toBe(0);
      expect(result.reports_by_category).toEqual([]);
      expect(result.reports_by_month).toEqual([]);
    });

    it('should provide comprehensive dashboard with all statistics', async () => {
      // Create reports from different users and categories
      await db.insert(reportsTable).values([
        {
          npsn: '12345678',
          school_name: 'School 1',
          category_id: testCategory1.id,
          issue_description: 'Technical issue 1',
          nisn: '1234567890',
          status: 'baru',
          reporter_id: testUser.id
        },
        {
          npsn: '12345679',
          school_name: 'School 2',
          category_id: testCategory1.id,
          issue_description: 'Technical issue 2',
          nisn: null,
          status: 'proses',
          reporter_id: testUser.id
        },
        {
          npsn: '12345680',
          school_name: 'School 3',
          category_id: testCategory2.id,
          issue_description: 'Admin issue 1',
          nisn: '1234567891',
          status: 'selesai',
          reporter_id: testAdmin.id
        },
        {
          npsn: '12345681',
          school_name: 'School 4',
          category_id: testCategory2.id,
          issue_description: 'Admin issue 2',
          nisn: null,
          status: 'baru',
          reporter_id: testAdmin.id
        }
      ]).execute();

      const result = await getAdminDashboard();

      expect(result.total_reports).toBe(4);
      expect(result.new_reports).toBe(2);
      expect(result.in_progress_reports).toBe(1);
      expect(result.completed_reports).toBe(1);

      // Check category breakdown
      expect(result.reports_by_category).toHaveLength(2);
      const techCategory = result.reports_by_category.find(c => c.category_name === 'Technical Issues');
      const adminCategory = result.reports_by_category.find(c => c.category_name === 'Administrative Issues');
      
      expect(techCategory?.count).toBe(2);
      expect(adminCategory?.count).toBe(2);

      // Check monthly data exists
      expect(result.reports_by_month.length).toBeGreaterThan(0);
      result.reports_by_month.forEach(month => {
        expect(month.month).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
        expect(typeof month.count).toBe('number');
        expect(month.count).toBeGreaterThan(0);
      });
    });

    it('should handle single category correctly', async () => {
      // Create reports only in one category
      await db.insert(reportsTable).values([
        {
          npsn: '12345678',
          school_name: 'School 1',
          category_id: testCategory1.id,
          issue_description: 'Technical issue 1',
          nisn: '1234567890',
          status: 'baru',
          reporter_id: testUser.id
        },
        {
          npsn: '12345679',
          school_name: 'School 2',
          category_id: testCategory1.id,
          issue_description: 'Technical issue 2',
          nisn: null,
          status: 'proses',
          reporter_id: testUser.id
        }
      ]).execute();

      const result = await getAdminDashboard();

      expect(result.total_reports).toBe(2);
      expect(result.reports_by_category).toHaveLength(1);
      expect(result.reports_by_category[0].category_name).toBe('Technical Issues');
      expect(result.reports_by_category[0].count).toBe(2);
    });
  });

  describe('getReportsSummary', () => {
    beforeEach(async () => {
      // Create test reports with different dates and categories
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);

      await db.insert(reportsTable).values([
        {
          npsn: '12345678',
          school_name: 'School 1',
          category_id: testCategory1.id,
          issue_description: 'Recent issue',
          nisn: '1234567890',
          status: 'baru',
          reporter_id: testUser.id,
          created_at: now
        },
        {
          npsn: '12345679',
          school_name: 'School 2',
          category_id: testCategory1.id,
          issue_description: 'Last month issue',
          nisn: null,
          status: 'proses',
          reporter_id: testUser.id,
          created_at: lastMonth
        },
        {
          npsn: '12345680',
          school_name: 'School 3',
          category_id: testCategory2.id,
          issue_description: 'Old issue',
          nisn: '1234567891',
          status: 'selesai',
          reporter_id: testAdmin.id,
          created_at: twoMonthsAgo
        }
      ]).execute();
    });

    it('should return summary without filters', async () => {
      const result = await getReportsSummary();

      expect(result.total).toBe(3);
      expect(result.by_status).toHaveLength(3);
      expect(result.by_category).toHaveLength(2);
      expect(result.by_month.length).toBeGreaterThan(0);

      // Check status counts
      const baruStatus = result.by_status.find(s => s.status === 'baru');
      const prosesStatus = result.by_status.find(s => s.status === 'proses');
      const selesaiStatus = result.by_status.find(s => s.status === 'selesai');

      expect(baruStatus?.count).toBe(1);
      expect(prosesStatus?.count).toBe(1);
      expect(selesaiStatus?.count).toBe(1);

      // Check category counts
      const techCategory = result.by_category.find(c => c.category_name === 'Technical Issues');
      const adminCategory = result.by_category.find(c => c.category_name === 'Administrative Issues');

      expect(techCategory?.count).toBe(2);
      expect(adminCategory?.count).toBe(1);
    });

    it('should filter by date range', async () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      twoMonthsAgo.setDate(1); // Set to beginning of month to ensure it's before our test data
      const dateFrom = twoMonthsAgo.toISOString().split('T')[0];

      const result = await getReportsSummary(dateFrom);

      expect(result.total).toBe(3); // Should include all reports since we're filtering from 2 months ago
      expect(result.by_status.some(s => s.status === 'selesai')).toBe(true);
    });

    it('should filter by category', async () => {
      const result = await getReportsSummary(undefined, undefined, testCategory1.id);

      expect(result.total).toBe(2);
      expect(result.by_category).toHaveLength(1);
      expect(result.by_category[0].category_name).toBe('Technical Issues');
      expect(result.by_category[0].count).toBe(2);
    });

    it('should combine date and category filters', async () => {
      const today = new Date().toISOString().split('T')[0];

      const result = await getReportsSummary(today, undefined, testCategory1.id);

      expect(result.total).toBe(1); // Only today's report in category 1
      expect(result.by_status).toHaveLength(1);
      expect(result.by_status[0].status).toBe('baru');
      expect(result.by_category).toHaveLength(1);
      expect(result.by_category[0].category_name).toBe('Technical Issues');
    });

    it('should return empty results when no reports match filters', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateFrom = futureDate.toISOString().split('T')[0];

      const result = await getReportsSummary(dateFrom);

      expect(result.total).toBe(0);
      expect(result.by_status).toEqual([]);
      expect(result.by_category).toEqual([]);
      expect(result.by_month).toEqual([]);
    });

    it('should handle date range filtering correctly', async () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      oneMonthAgo.setDate(1); // Set to beginning of month
      const dateFrom = oneMonthAgo.toISOString().split('T')[0];
      
      const today = new Date();
      const dateTo = today.toISOString().split('T')[0];

      const result = await getReportsSummary(dateFrom, dateTo);

      expect(result.total).toBe(2); // Should exclude the report from 2 months ago
      expect(result.by_month.length).toBeGreaterThan(0);

      // Verify all months in result are within range
      result.by_month.forEach(month => {
        expect(month.month).toMatch(/^\d{4}-\d{2}$/);
        const monthDate = new Date(month.month + '-01');
        expect(monthDate >= new Date(dateFrom)).toBe(true);
      });
    });
  });
});