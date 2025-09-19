import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type User, type PaginatedResponse } from '../schema';
import { eq, and, or, ilike, count, SQL } from 'drizzle-orm';
// Using Bun's built-in password hashing

// Create a new user
export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Hash the password using Bun
    const password_hash = await Bun.password.hash(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        name: input.name,
        email: input.email,
        password_hash,
        role: input.role,
        is_active: input.is_active,
        updated_at: new Date()
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};

// Get all users with pagination and filtering
export const getUsers = async (filters?: { 
  search?: string; 
  role?: 'pelapor' | 'admin'; 
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<User>> => {
  try {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Search filter - search in name, username, and email
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(usersTable.name, searchTerm),
          ilike(usersTable.username, searchTerm),
          ilike(usersTable.email, searchTerm)
        )!
      );
    }

    // Role filter
    if (filters?.role) {
      conditions.push(eq(usersTable.role, filters.role));
    }

    // Active status filter
    if (filters?.is_active !== undefined) {
      conditions.push(eq(usersTable.is_active, filters.is_active));
    }

    // Execute queries with or without conditions
    let users, totalResult;

    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      
      [users, totalResult] = await Promise.all([
        db.select()
          .from(usersTable)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .execute(),
        db.select({ count: count() })
          .from(usersTable)
          .where(whereClause)
          .execute()
      ]);
    } else {
      [users, totalResult] = await Promise.all([
        db.select()
          .from(usersTable)
          .limit(limit)
          .offset(offset)
          .execute(),
        db.select({ count: count() })
          .from(usersTable)
          .execute()
      ]);
    }

    const total = totalResult[0].count;
    const total_pages = Math.ceil(total / limit);

    return {
      data: users,
      total,
      page,
      limit,
      total_pages
    };
  } catch (error) {
    console.error('Users fetch failed:', error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (id: number): Promise<User | null> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('User fetch by ID failed:', error);
    throw error;
  }
};

// Update user
export const updateUser = async (input: UpdateUserInput): Promise<User> => {
  try {
    // Build update object
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.username !== undefined) updateData.username = input.username;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Hash password if provided
    if (input.password !== undefined) {
      updateData.password_hash = await Bun.password.hash(input.password);
    }

    // Update user record
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with ID ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
};

// Delete user (soft delete by setting is_active to false)
export const deleteUser = async (id: number): Promise<boolean> => {
  try {
    const result = await db.update(usersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
};

// Reset user password
export const resetUserPassword = async (id: number, newPassword: string): Promise<boolean> => {
  try {
    // Hash the new password
    const password_hash = await Bun.password.hash(newPassword);

    const result = await db.update(usersTable)
      .set({ 
        password_hash,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
};