import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

// Simple password hashing utility (in production, use bcrypt or similar)
const hashPassword = (password: string): string => {
  // This is a simple implementation for demo purposes
  // In production, use proper bcrypt hashing with salt
  return Buffer.from(password).toString('base64');
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

// Login handler - authenticates user and returns user data
export const login = async (input: LoginInput): Promise<User> => {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('User account is disabled');
    }

    // Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid username or password');
    }

    // Return user data without password hash
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      password_hash: '', // Never return the actual password hash
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

// Get current user profile
export const getCurrentUser = async (userId: number): Promise<User | null> => {
  try {
    // Find user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Return user data without password hash
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      password_hash: '', // Never return the actual password hash
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Get current user failed:', error);
    throw error;
  }
};

// Export utility functions for testing
export { hashPassword, verifyPassword };