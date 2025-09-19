import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, reportsTable } from '../db/schema';
import { type ReportFilter } from '../schema';
import { exportReportsToCSV, exportReportsSummaryToCSV } from '../handlers/export';

// Test data
const testUsers = [
  {
    username: 'reporter1',
    name: 'Reporter One',
    email: 'reporter1@test.com',
    password_hash: 'hashed_password',
    role: 'pelapor' as const,
    is_active: true
  },
  {
    username: 'admin1',
    name: 'Admin One',
    email: 'admin1@test.com',
    password_hash: 'hashed_password',
    role: 'admin' as const,
    is_active: true
  }
];

const testCategories = [
  {
    name: 'Akademik',
    description: 'Masalah akademik',
    is_active: true
  },
  {
    name: 'Fasilitas',
    description: 'Masalah fasilitas',
    is_active: true
  }
];

describe('exportReportsToCSV', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should export basic reports to CSV format', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create test reports
    const testReports = [
      {
        npsn: '12345678',
        school_name: 'Test School 1',
        category_id: categories[0].id,
        issue_description: 'Test issue 1',
        nisn: '1234567890',
        status: 'baru' as const,
        reporter_id: users[0].id
      },
      {
        npsn: '87654321',
        school_name: 'Test School 2',
        category_id: categories[1].id,
        issue_description: 'Test issue 2',
        nisn: null,
        status: 'proses' as const,
        reporter_id: users[1].id
      }
    ];

    await db.insert(reportsTable).values(testReports).execute();

    // Export with no filters
    const filters: ReportFilter = {
      page: 1,
      limit: 10
    };

    const csvResult = await exportReportsToCSV(filters);

    // Verify CSV structure
    expect(csvResult).toContain('ID,NPSN,Nama Madrasah,Kategori,Deskripsi Masalah,NISN,Status,Pelapor,Tanggal Dibuat,Tanggal Diperbarui');
    expect(csvResult).toContain('Test School 1');
    expect(csvResult).toContain('Test School 2');
    expect(csvResult).toContain('12345678');
    expect(csvResult).toContain('87654321');
    expect(csvResult).toContain('Akademik');
    expect(csvResult).toContain('Fasilitas');
    expect(csvResult).toContain('baru');
    expect(csvResult).toContain('proses');

    // Count lines (header + 2 data rows)
    const lines = csvResult.split('\n').filter(line => line.trim().length > 0);
    expect(lines.length).toBe(3);
  });

  it('should apply status filter correctly', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create reports with different statuses
    const testReports = [
      {
        npsn: '12345678',
        school_name: 'Test School 1',
        category_id: categories[0].id,
        issue_description: 'Test issue 1',
        nisn: '1234567890',
        status: 'baru' as const,
        reporter_id: users[0].id
      },
      {
        npsn: '87654321',
        school_name: 'Test School 2',
        category_id: categories[1].id,
        issue_description: 'Test issue 2',
        nisn: null,
        status: 'selesai' as const,
        reporter_id: users[1].id
      }
    ];

    await db.insert(reportsTable).values(testReports).execute();

    // Filter by status
    const filters: ReportFilter = {
      status: 'baru',
      page: 1,
      limit: 10
    };

    const csvResult = await exportReportsToCSV(filters);

    // Should only contain 'baru' status reports
    expect(csvResult).toContain('Test School 1');
    expect(csvResult).toContain('baru');
    expect(csvResult).not.toContain('Test School 2');
    expect(csvResult).not.toContain('selesai');

    const lines = csvResult.split('\n').filter(line => line.trim().length > 0);
    expect(lines.length).toBe(2); // header + 1 data row
  });

  it('should apply date range filter correctly', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create reports with specific dates
    const oldReport = {
      npsn: '12345678',
      school_name: 'Old School',
      category_id: categories[0].id,
      issue_description: 'Old issue',
      nisn: '1234567890',
      status: 'baru' as const,
      reporter_id: users[0].id
    };

    const newReport = {
      npsn: '87654321',
      school_name: 'New School',
      category_id: categories[1].id,
      issue_description: 'New issue',
      nisn: null,
      status: 'proses' as const,
      reporter_id: users[1].id
    };

    await db.insert(reportsTable).values([oldReport, newReport]).execute();

    // Filter by recent date
    const today = new Date();
    const filters: ReportFilter = {
      date_from: today.toISOString().split('T')[0],
      page: 1,
      limit: 10
    };

    const csvResult = await exportReportsToCSV(filters);

    // Should contain both reports since they were created today
    expect(csvResult).toContain('Old School');
    expect(csvResult).toContain('New School');

    const lines = csvResult.split('\n').filter(line => line.trim().length > 0);
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it('should handle CSV escaping correctly', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create report with special characters
    const specialReport = {
      npsn: '12345678',
      school_name: 'School with "Quotes" and, Commas',
      category_id: categories[0].id,
      issue_description: 'Issue with\nnewlines and "quotes"',
      nisn: '1234567890',
      status: 'baru' as const,
      reporter_id: users[0].id
    };

    await db.insert(reportsTable).values([specialReport]).execute();

    const filters: ReportFilter = {
      page: 1,
      limit: 10
    };

    const csvResult = await exportReportsToCSV(filters);

    // Should properly escape special characters
    expect(csvResult).toContain('"School with ""Quotes"" and, Commas"');
    expect(csvResult).toContain('"Issue with\nnewlines and ""quotes"""');
  });

  it('should handle empty results', async () => {
    // No data created - empty database
    const filters: ReportFilter = {
      status: 'baru',
      page: 1,
      limit: 10
    };

    const csvResult = await exportReportsToCSV(filters);

    // Should contain only headers
    expect(csvResult).toBe('ID,NPSN,Nama Madrasah,Kategori,Deskripsi Masalah,NISN,Status,Pelapor,Tanggal Dibuat,Tanggal Diperbarui\n');
  });
});

describe('exportReportsSummaryToCSV', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should export reports summary to CSV format', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create test reports with different statuses and categories
    const testReports = [
      {
        npsn: '12345678',
        school_name: 'Test School 1',
        category_id: categories[0].id,
        issue_description: 'Test issue 1',
        nisn: '1234567890',
        status: 'baru' as const,
        reporter_id: users[0].id
      },
      {
        npsn: '87654321',
        school_name: 'Test School 2',
        category_id: categories[0].id,
        issue_description: 'Test issue 2',
        nisn: null,
        status: 'proses' as const,
        reporter_id: users[1].id
      },
      {
        npsn: '11223344',
        school_name: 'Test School 3',
        category_id: categories[1].id,
        issue_description: 'Test issue 3',
        nisn: '9876543210',
        status: 'selesai' as const,
        reporter_id: users[0].id
      }
    ];

    await db.insert(reportsTable).values(testReports).execute();

    const csvResult = await exportReportsSummaryToCSV();

    // Verify CSV structure and content
    expect(csvResult).toContain('Ringkasan,Jumlah');
    expect(csvResult).toContain('Ringkasan per Status');
    expect(csvResult).toContain('Ringkasan per Kategori');
    expect(csvResult).toContain('Ringkasan per Bulan');
    expect(csvResult).toContain('Total Laporan,3');

    // Should contain status counts
    expect(csvResult).toContain('baru,1');
    expect(csvResult).toContain('proses,1');
    expect(csvResult).toContain('selesai,1');

    // Should contain category counts
    expect(csvResult).toContain('Akademik,2');
    expect(csvResult).toContain('Fasilitas,1');
  });

  it('should apply date filters to summary', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create test reports
    const testReports = [
      {
        npsn: '12345678',
        school_name: 'Test School 1',
        category_id: categories[0].id,
        issue_description: 'Test issue 1',
        nisn: '1234567890',
        status: 'baru' as const,
        reporter_id: users[0].id
      },
      {
        npsn: '87654321',
        school_name: 'Test School 2',
        category_id: categories[1].id,
        issue_description: 'Test issue 2',
        nisn: null,
        status: 'proses' as const,
        reporter_id: users[1].id
      }
    ];

    await db.insert(reportsTable).values(testReports).execute();

    const today = new Date();
    const csvResult = await exportReportsSummaryToCSV(
      today.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    // Should include reports from today
    expect(csvResult).toContain('Total Laporan,2');
    expect(csvResult).toContain('baru,1');
    expect(csvResult).toContain('proses,1');
  });

  it('should apply category filter to summary', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create test reports for different categories
    const testReports = [
      {
        npsn: '12345678',
        school_name: 'Test School 1',
        category_id: categories[0].id, // Akademik
        issue_description: 'Test issue 1',
        nisn: '1234567890',
        status: 'baru' as const,
        reporter_id: users[0].id
      },
      {
        npsn: '87654321',
        school_name: 'Test School 2',
        category_id: categories[1].id, // Fasilitas
        issue_description: 'Test issue 2',
        nisn: null,
        status: 'proses' as const,
        reporter_id: users[1].id
      }
    ];

    await db.insert(reportsTable).values(testReports).execute();

    // Filter by first category only
    const csvResult = await exportReportsSummaryToCSV(undefined, undefined, categories[0].id);

    // Should only include reports from the specified category
    expect(csvResult).toContain('Total Laporan,1');
    expect(csvResult).toContain('baru,1');
    expect(csvResult).not.toContain('proses,1');
  });

  it('should handle empty summary results', async () => {
    // No data created - empty database
    const csvResult = await exportReportsSummaryToCSV();

    // Should contain structure but no data
    expect(csvResult).toContain('Ringkasan,Jumlah');
    expect(csvResult).toContain('Total Laporan,0');
  });

  it('should include monthly breakdown', async () => {
    // Create prerequisite data
    const users = await db.insert(usersTable).values(testUsers).returning().execute();
    const categories = await db.insert(categoriesTable).values(testCategories).returning().execute();

    // Create test report
    const testReport = {
      npsn: '12345678',
      school_name: 'Test School 1',
      category_id: categories[0].id,
      issue_description: 'Test issue 1',
      nisn: '1234567890',
      status: 'baru' as const,
      reporter_id: users[0].id
    };

    await db.insert(reportsTable).values([testReport]).execute();

    const csvResult = await exportReportsSummaryToCSV();

    // Should contain current month in summary
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    expect(csvResult).toContain(currentMonth);
    expect(csvResult).toContain('Ringkasan per Bulan');
  });
});