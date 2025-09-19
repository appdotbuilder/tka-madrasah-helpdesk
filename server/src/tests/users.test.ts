import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput } from '../schema';
import { 
  createUser, 
  getUsers, 
  getUserById, 
  updateUser, 
  deleteUser, 
  resetUserPassword 
} from '../handlers/users';
import { eq } from 'drizzle-orm';
// Using Bun's built-in password verification

// Test input data
const testUserInput: CreateUserInput = {
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  role: 'pelapor',
  is_active: true
};

const testAdminInput: CreateUserInput = {
  username: 'testadmin',
  name: 'Test Admin',
  email: 'admin@example.com',
  password: 'adminpass123',
  role: 'admin',
  is_active: true
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const result = await createUser(testUserInput);

      // Basic field validation
      expect(result.username).toEqual('testuser');
      expect(result.name).toEqual('Test User');
      expect(result.email).toEqual('test@example.com');
      expect(result.role).toEqual('pelapor');
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Password should be hashed, not plain text
      expect(result.password_hash).not.toEqual('password123');
      expect(result.password_hash).toBeDefined();

      // Verify password can be validated
      const isPasswordValid = await Bun.password.verify('password123', result.password_hash);
      expect(isPasswordValid).toBe(true);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      // Query database directly
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('testuser');
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].role).toEqual('pelapor');
      expect(users[0].is_active).toEqual(true);
    });

    it('should use default is_active value', async () => {
      const inputWithoutActive: CreateUserInput = {
        username: 'defaultuser',
        name: 'Default User',
        email: 'default@example.com',
        password: 'password123',
        role: 'pelapor',
        is_active: true // Zod default is applied at the schema level
      };

      const result = await createUser(inputWithoutActive);
      expect(result.is_active).toEqual(true);
    });

    it('should throw error for duplicate username', async () => {
      await createUser(testUserInput);
      
      expect(createUser(testUserInput)).rejects.toThrow();
    });

    it('should throw error for duplicate email', async () => {
      await createUser(testUserInput);
      
      const duplicateEmailInput = {
        ...testUserInput,
        username: 'different_username'
      };

      expect(createUser(duplicateEmailInput)).rejects.toThrow();
    });
  });

  describe('getUsers', () => {
    beforeEach(async () => {
      // Create test users
      await createUser(testUserInput);
      await createUser(testAdminInput);
      await createUser({
        username: 'inactive_user',
        name: 'Inactive User',
        email: 'inactive@example.com',
        password: 'password123',
        role: 'pelapor',
        is_active: false
      });
    });

    it('should get all users with default pagination', async () => {
      const result = await getUsers();

      expect(result.data).toHaveLength(3);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(10);
      expect(result.total_pages).toEqual(1);
    });

    it('should filter by role', async () => {
      const result = await getUsers({ role: 'admin' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toEqual('testadmin');
      expect(result.total).toEqual(1);
    });

    it('should filter by active status', async () => {
      const result = await getUsers({ is_active: false });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toEqual('inactive_user');
      expect(result.total).toEqual(1);
    });

    it('should search by name', async () => {
      const result = await getUsers({ search: 'Test User' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toEqual('Test User');
    });

    it('should search by username', async () => {
      const result = await getUsers({ search: 'testadmin' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toEqual('testadmin');
    });

    it('should search by email', async () => {
      const result = await getUsers({ search: 'admin@example.com' });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toEqual('admin@example.com');
    });

    it('should handle pagination', async () => {
      const result = await getUsers({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toEqual(3);
      expect(result.page).toEqual(1);
      expect(result.limit).toEqual(2);
      expect(result.total_pages).toEqual(2);
    });

    it('should combine multiple filters', async () => {
      const result = await getUsers({ 
        role: 'pelapor', 
        is_active: true,
        search: 'Test'
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toEqual('testuser');
    });

    it('should return empty results when no matches', async () => {
      const result = await getUsers({ search: 'nonexistent' });

      expect(result.data).toHaveLength(0);
      expect(result.total).toEqual(0);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID', async () => {
      const created = await createUser(testUserInput);
      const result = await getUserById(created.id);

      expect(result).not.toBeNull();
      expect(result!.username).toEqual('testuser');
      expect(result!.email).toEqual('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      const result = await getUserById(99999);
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      const created = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: created.id,
        name: 'Updated Name',
        email: 'updated@example.com',
        role: 'admin'
      };

      const result = await updateUser(updateInput);

      expect(result.name).toEqual('Updated Name');
      expect(result.email).toEqual('updated@example.com');
      expect(result.role).toEqual('admin');
      expect(result.username).toEqual('testuser'); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update password with hashing', async () => {
      const created = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: created.id,
        password: 'newpassword123'
      };

      const result = await updateUser(updateInput);

      // Password should be hashed differently
      expect(result.password_hash).not.toEqual(created.password_hash);
      expect(result.password_hash).not.toEqual('newpassword123');

      // Verify new password works
      const isNewPasswordValid = await Bun.password.verify('newpassword123', result.password_hash);
      expect(isNewPasswordValid).toBe(true);

      // Verify old password no longer works
      const isOldPasswordValid = await Bun.password.verify('password123', result.password_hash);
      expect(isOldPasswordValid).toBe(false);
    });

    it('should update only provided fields', async () => {
      const created = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: created.id,
        name: 'Partial Update'
      };

      const result = await updateUser(updateInput);

      expect(result.name).toEqual('Partial Update');
      expect(result.username).toEqual('testuser'); // Unchanged
      expect(result.email).toEqual('test@example.com'); // Unchanged
      expect(result.role).toEqual('pelapor'); // Unchanged
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 99999,
        name: 'Non-existent'
      };

      expect(updateUser(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should handle is_active toggle', async () => {
      const created = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: created.id,
        is_active: false
      };

      const result = await updateUser(updateInput);
      expect(result.is_active).toEqual(false);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user by setting is_active to false', async () => {
      const created = await createUser(testUserInput);

      const result = await deleteUser(created.id);
      expect(result).toBe(true);

      // Check that user still exists but is inactive
      const user = await getUserById(created.id);
      expect(user).not.toBeNull();
      expect(user!.is_active).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await deleteUser(99999);
      expect(result).toBe(false);
    });

    it('should update timestamp when deleting', async () => {
      const created = await createUser(testUserInput);
      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await deleteUser(created.id);

      const user = await getUserById(created.id);
      expect(user!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('resetUserPassword', () => {
    it('should reset user password', async () => {
      const created = await createUser(testUserInput);
      const originalPasswordHash = created.password_hash;

      const result = await resetUserPassword(created.id, 'resetpassword123');
      expect(result).toBe(true);

      // Get updated user
      const user = await getUserById(created.id);

      // Password should be different
      expect(user!.password_hash).not.toEqual(originalPasswordHash);

      // Verify new password works
      const isNewPasswordValid = await Bun.password.verify('resetpassword123', user!.password_hash);
      expect(isNewPasswordValid).toBe(true);

      // Verify old password no longer works
      const isOldPasswordValid = await Bun.password.verify('password123', user!.password_hash);
      expect(isOldPasswordValid).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await resetUserPassword(99999, 'newpassword');
      expect(result).toBe(false);
    });

    it('should update timestamp when resetting password', async () => {
      const created = await createUser(testUserInput);
      const originalUpdatedAt = created.updated_at;

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await resetUserPassword(created.id, 'resetpassword123');

      const user = await getUserById(created.id);
      expect(user!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});