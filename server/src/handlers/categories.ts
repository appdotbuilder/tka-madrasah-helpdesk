import { db } from '../db';
import { categoriesTable, reportsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq, count } from 'drizzle-orm';

// Create a new category
export const createCategory = async (input: CreateCategoryInput): Promise<Category> => {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description,
        is_active: input.is_active
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
};

// Get all active categories
export const getCategories = async (): Promise<Category[]> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.is_active, true))
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch active categories:', error);
    throw error;
  }
};

// Get all categories (admin view)
export const getAllCategories = async (): Promise<Category[]> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch all categories:', error);
    throw error;
  }
};

// Get category by ID
export const getCategoryById = async (id: number): Promise<Category | null> => {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error('Failed to fetch category by ID:', error);
    throw error;
  }
};

// Update category
export const updateCategory = async (input: UpdateCategoryInput): Promise<Category> => {
  try {
    // Prepare update data - only include fields that were provided
    const updateData: Partial<typeof categoriesTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Category not found');
    }

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
};

// Delete category (soft delete)
export const deleteCategory = async (id: number): Promise<boolean> => {
  try {
    // First check if category is being used by any reports
    const reportCount = await db.select({ count: count() })
      .from(reportsTable)
      .where(eq(reportsTable.category_id, id))
      .execute();

    if (reportCount[0].count > 0) {
      throw new Error('Cannot delete category that is being used by reports');
    }

    // Perform soft delete by setting is_active to false
    const result = await db.update(categoriesTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(categoriesTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
};