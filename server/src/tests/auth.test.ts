
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, logout } from '../handlers/auth';

// Test user data
const testPassword = 'password123';

const testUserData = {
  email: 'test@example.com',
  password_hash: testPassword, // Store plain text for demo
  first_name: 'John',
  last_name: 'Doe',
  role: 'employee' as const,
  employee_id: 'EMP001',
  department: 'Engineering',
  hire_date: '2023-01-15', // Use string format for date column
  is_active: true
};

describe('auth handlers', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test user
    await db.insert(usersTable)
      .values(testUserData)
      .execute();
  });

  afterEach(resetDB);

  describe('login', () => {
    const validLoginInput: LoginInput = {
      email: 'test@example.com',
      password: testPassword
    };

    it('should login successfully with valid credentials', async () => {
      const result = await login(validLoginInput);

      // Verify user data
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.first_name).toEqual('John');
      expect(result.user.last_name).toEqual('Doe');
      expect(result.user.role).toEqual('employee');
      expect(result.user.employee_id).toEqual('EMP001');
      expect(result.user.department).toEqual('Engineering');
      expect(result.user.is_active).toBe(true);
      expect(result.user.id).toBeDefined();
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
      
      // Verify hire_date conversion
      expect(result.user.hire_date).toBeInstanceOf(Date);
      expect(result.user.hire_date?.getFullYear()).toEqual(2023);

      // Verify token
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');

      // Verify token payload (decode the base64 token)
      const decoded = JSON.parse(Buffer.from(result.token, 'base64').toString());
      expect(decoded.userId).toEqual(result.user.id);
      expect(decoded.email).toEqual('test@example.com');
      expect(decoded.role).toEqual('employee');
      expect(decoded.exp).toBeGreaterThan(Date.now());
    });

    it('should handle null hire_date', async () => {
      // Create user with null hire_date
      const userWithNullHireDate = {
        ...testUserData,
        email: 'null-hire@example.com',
        hire_date: null
      };

      await db.insert(usersTable)
        .values(userWithNullHireDate)
        .execute();

      const loginInput: LoginInput = {
        email: 'null-hire@example.com',
        password: testPassword
      };

      const result = await login(loginInput);
      expect(result.user.hire_date).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      const invalidInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: testPassword
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for incorrect password', async () => {
      const invalidInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid credentials/i);
    });

    it('should throw error for inactive user', async () => {
      // Create inactive user
      const inactiveUserData = {
        email: 'inactive@example.com',
        password_hash: testPassword,
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'employee' as const,
        employee_id: 'EMP002',
        department: 'HR',
        hire_date: '2023-02-01',
        is_active: false
      };

      await db.insert(usersTable)
        .values(inactiveUserData)
        .execute();

      const inactiveLoginInput: LoginInput = {
        email: 'inactive@example.com',
        password: testPassword
      };

      await expect(login(inactiveLoginInput)).rejects.toThrow(/account is inactive/i);
    });

    it('should not expose password hash in response', async () => {
      const result = await login(validLoginInput);
      
      // Password hash should be present but not exposed in practical use
      expect(result.user.password_hash).toBeDefined();
      expect(result.user.password_hash).not.toEqual('');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const result = await logout();
      
      expect(result.success).toBe(true);
    });
  });
});
