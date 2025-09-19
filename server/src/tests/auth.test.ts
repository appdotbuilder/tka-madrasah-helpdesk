import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, getCurrentUser, hashPassword, verifyPassword } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  username: 'testuser',
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  role: 'pelapor' as const,
  is_active: true
};

const testAdmin = {
  username: 'testadmin',
  name: 'Test Admin',
  email: 'admin@example.com',
  password: 'admin123',
  role: 'admin' as const,
  is_active: true
};

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('login', () => {
    it('should authenticate valid user credentials', async () => {
      // Create test user
      await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: testUser.is_active
      }).execute();

      const loginInput: LoginInput = {
        username: testUser.username,
        password: testUser.password
      };

      const result = await login(loginInput);

      // Verify user data is returned correctly
      expect(result.username).toEqual(testUser.username);
      expect(result.name).toEqual(testUser.name);
      expect(result.email).toEqual(testUser.email);
      expect(result.role).toEqual(testUser.role);
      expect(result.is_active).toEqual(testUser.is_active);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      
      // Password hash should never be returned
      expect(result.password_hash).toEqual('');
    });

    it('should authenticate admin user', async () => {
      // Create test admin
      await db.insert(usersTable).values({
        username: testAdmin.username,
        name: testAdmin.name,
        email: testAdmin.email,
        password_hash: hashPassword(testAdmin.password),
        role: testAdmin.role,
        is_active: testAdmin.is_active
      }).execute();

      const loginInput: LoginInput = {
        username: testAdmin.username,
        password: testAdmin.password
      };

      const result = await login(loginInput);

      expect(result.username).toEqual(testAdmin.username);
      expect(result.role).toEqual('admin');
    });

    it('should reject invalid username', async () => {
      const loginInput: LoginInput = {
        username: 'nonexistent',
        password: 'anypassword'
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should reject invalid password', async () => {
      // Create test user
      await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: testUser.is_active
      }).execute();

      const loginInput: LoginInput = {
        username: testUser.username,
        password: 'wrongpassword'
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid username or password/i);
    });

    it('should reject inactive user', async () => {
      // Create inactive user
      await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: false
      }).execute();

      const loginInput: LoginInput = {
        username: testUser.username,
        password: testUser.password
      };

      await expect(login(loginInput)).rejects.toThrow(/user account is disabled/i);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user profile for valid user ID', async () => {
      // Create test user
      const insertResult = await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: testUser.is_active
      }).returning().execute();

      const userId = insertResult[0].id;

      const result = await getCurrentUser(userId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(userId);
      expect(result!.username).toEqual(testUser.username);
      expect(result!.name).toEqual(testUser.name);
      expect(result!.email).toEqual(testUser.email);
      expect(result!.role).toEqual(testUser.role);
      expect(result!.is_active).toEqual(testUser.is_active);
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
      
      // Password hash should never be returned
      expect(result!.password_hash).toEqual('');
    });

    it('should return null for non-existent user ID', async () => {
      const result = await getCurrentUser(999);
      expect(result).toBeNull();
    });

    it('should return inactive user profile', async () => {
      // Create inactive user
      const insertResult = await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: false
      }).returning().execute();

      const userId = insertResult[0].id;

      const result = await getCurrentUser(userId);

      expect(result).not.toBeNull();
      expect(result!.is_active).toEqual(false);
    });

    it('should handle database query correctly', async () => {
      // Create test user
      const insertResult = await db.insert(usersTable).values({
        username: testUser.username,
        name: testUser.name,
        email: testUser.email,
        password_hash: hashPassword(testUser.password),
        role: testUser.role,
        is_active: testUser.is_active
      }).returning().execute();

      const userId = insertResult[0].id;

      // Verify user exists in database
      const dbUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      expect(dbUser).toHaveLength(1);
      expect(dbUser[0].username).toEqual(testUser.username);

      // Verify handler returns correct data
      const result = await getCurrentUser(userId);
      expect(result!.username).toEqual(dbUser[0].username);
    });
  });

  describe('password utilities', () => {
    it('should hash passwords consistently', () => {
      const password = 'testpassword123';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      
      expect(hash1).toEqual(hash2);
      expect(hash1).not.toEqual(password);
    });

    it('should verify correct passwords', () => {
      const password = 'testpassword123';
      const hash = hashPassword(password);
      
      expect(verifyPassword(password, hash)).toBe(true);
    });

    it('should reject incorrect passwords', () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = hashPassword(password);
      
      expect(verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it('should handle empty passwords', () => {
      const emptyPassword = '';
      const hash = hashPassword(emptyPassword);
      
      expect(verifyPassword(emptyPassword, hash)).toBe(true);
      expect(verifyPassword('notempty', hash)).toBe(false);
    });
  });
});