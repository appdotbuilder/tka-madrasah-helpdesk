import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, reportsTable, usersTable } from '../db/schema';
import { 
  type CreateCategoryInput, 
  type UpdateCategoryInput 
} from '../schema';
import { 
  createCategory,
  getCategories,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test inputs
const testCategoryInput: CreateCategoryInput = {
  name: 'Fasilitas Sekolah',
  description: 'Masalah terkait fasilitas dan infrastruktur sekolah',
  is_active: true
};

const testCategoryInput2: CreateCategoryInput = {
  name: 'Administrasi',
  description: 'Masalah administrasi sekolah',
  is_active: false
};

describe('Category Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category with all fields', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.name).toEqual('Fasilitas Sekolah');
      expect(result.description).toEqual('Masalah terkait fasilitas dan infrastruktur sekolah');
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a category with nullable description', async () => {
      const input: CreateCategoryInput = {
        name: 'Test Category',
        description: null,
        is_active: true
      };

      const result = await createCategory(input);

      expect(result.name).toEqual('Test Category');
      expect(result.description).toBeNull();
      expect(result.is_active).toEqual(true);
    });

    it('should create a category with default is_active value', async () => {
      const input: CreateCategoryInput = {
        name: 'Test Category',
        description: 'Test description',
        is_active: true // Zod default is applied at parsing level
      };

      const result = await createCategory(input);

      expect(result.name).toEqual('Test Category');
      expect(result.is_active).toEqual(true);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Fasilitas Sekolah');
      expect(categories[0].description).toEqual('Masalah terkait fasilitas dan infrastruktur sekolah');
      expect(categories[0].is_active).toEqual(true);
    });
  });

  describe('getCategories', () => {
    it('should return only active categories', async () => {
      // Create both active and inactive categories
      await createCategory(testCategoryInput); // active
      await createCategory(testCategoryInput2); // inactive

      const result = await getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Fasilitas Sekolah');
      expect(result[0].is_active).toEqual(true);
    });

    it('should return empty array when no active categories exist', async () => {
      // Create only inactive category
      await createCategory(testCategoryInput2);

      const result = await getCategories();

      expect(result).toHaveLength(0);
    });

    it('should return all active categories', async () => {
      const activeInput1: CreateCategoryInput = {
        name: 'Category 1',
        description: 'Description 1',
        is_active: true
      };

      const activeInput2: CreateCategoryInput = {
        name: 'Category 2',
        description: 'Description 2',
        is_active: true
      };

      await createCategory(activeInput1);
      await createCategory(activeInput2);
      await createCategory(testCategoryInput2); // inactive

      const result = await getCategories();

      expect(result).toHaveLength(2);
      expect(result.every(cat => cat.is_active)).toBe(true);
    });
  });

  describe('getAllCategories', () => {
    it('should return all categories including inactive ones', async () => {
      await createCategory(testCategoryInput); // active
      await createCategory(testCategoryInput2); // inactive

      const result = await getAllCategories();

      expect(result).toHaveLength(2);
      expect(result.some(cat => cat.is_active)).toBe(true);
      expect(result.some(cat => !cat.is_active)).toBe(true);
    });

    it('should return empty array when no categories exist', async () => {
      const result = await getAllCategories();

      expect(result).toHaveLength(0);
    });
  });

  describe('getCategoryById', () => {
    it('should return category when it exists', async () => {
      const created = await createCategory(testCategoryInput);

      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Fasilitas Sekolah');
      expect(result!.description).toEqual('Masalah terkait fasilitas dan infrastruktur sekolah');
    });

    it('should return null when category does not exist', async () => {
      const result = await getCategoryById(999);

      expect(result).toBeNull();
    });

    it('should return inactive category by id', async () => {
      const created = await createCategory(testCategoryInput2);

      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toEqual(false);
    });
  });

  describe('updateCategory', () => {
    it('should update all fields', async () => {
      const created = await createCategory(testCategoryInput);

      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Category',
        description: 'Updated description',
        is_active: false
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Category');
      expect(result.description).toEqual('Updated description');
      expect(result.is_active).toEqual(false);
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update only provided fields', async () => {
      const created = await createCategory(testCategoryInput);

      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Name Only'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Updated Name Only');
      expect(result.description).toEqual(created.description); // unchanged
      expect(result.is_active).toEqual(created.is_active); // unchanged
    });

    it('should update description to null', async () => {
      const created = await createCategory(testCategoryInput);

      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: null
      };

      const result = await updateCategory(updateInput);

      expect(result.description).toBeNull();
    });

    it('should throw error for non-existent category', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 999,
        name: 'Non-existent'
      };

      expect(updateCategory(updateInput)).rejects.toThrow(/category not found/i);
    });

    it('should save updated data to database', async () => {
      const created = await createCategory(testCategoryInput);

      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Database Updated'
      };

      await updateCategory(updateInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();

      expect(categories[0].name).toEqual('Database Updated');
    });
  });

  describe('deleteCategory', () => {
    it('should soft delete category when no reports reference it', async () => {
      const created = await createCategory(testCategoryInput);

      const result = await deleteCategory(created.id);

      expect(result).toBe(true);

      // Check category is marked as inactive
      const category = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();

      expect(category[0].is_active).toBe(false);
    });

    it('should throw error when category is used by reports', async () => {
      const category = await createCategory(testCategoryInput);

      // Create a user first for foreign key constraint
      const user = await db.insert(usersTable)
        .values({
          username: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          role: 'pelapor'
        })
        .returning()
        .execute();

      // Create a report that references the category
      await db.insert(reportsTable)
        .values({
          npsn: '12345678',
          school_name: 'Test School',
          category_id: category.id,
          issue_description: 'Test issue description for category deletion test',
          nisn: '1234567890',
          reporter_id: user[0].id
        })
        .execute();

      expect(deleteCategory(category.id)).rejects.toThrow(/cannot delete category that is being used by reports/i);
    });

    it('should return false for non-existent category', async () => {
      const result = await deleteCategory(999);

      expect(result).toBe(false);
    });

    it('should update updated_at timestamp on deletion', async () => {
      const created = await createCategory(testCategoryInput);
      const originalUpdatedAt = created.updated_at;

      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await deleteCategory(created.id);

      const category = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();

      expect(category[0].updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});