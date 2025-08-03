
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput } from '../schema';
import { 
  createUser, 
  updateUser, 
  deleteUser, 
  getAllUsers, 
  getUserById 
} from '../handlers/user_management';
import { eq } from 'drizzle-orm';

const testCreateInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'employee',
  employee_id: 'EMP001',
  department: 'Engineering',
  hire_date: new Date('2024-01-01')
};

const testAdminInput: CreateUserInput = {
  email: 'admin@example.com',
  password: 'adminpass123',
  first_name: 'Jane',
  last_name: 'Admin',
  role: 'admin',
  employee_id: 'ADM001',
  department: 'Management',
  hire_date: new Date('2023-06-01')
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user', async () => {
    const result = await createUser(testCreateInput);

    expect(result.email).toEqual('test@example.com');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.role).toEqual('employee');
    expect(result.employee_id).toEqual('EMP001');
    expect(result.department).toEqual('Engineering');
    expect(result.hire_date).toEqual(new Date('2024-01-01'));
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
  });

  it('should hash the password', async () => {
    const result = await createUser(testCreateInput);

    // Verify password was hashed (simple hash for testing)
    expect(result.password_hash).toEqual('hashed_password123');

    // Verify original password is not stored
    expect(result.password_hash).not.toEqual('password123');
  });

  it('should save user to database', async () => {
    const result = await createUser(testCreateInput);

    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].first_name).toEqual('John');
    expect(users[0].role).toEqual('employee');
    expect(users[0].is_active).toBe(true);
    expect(users[0].hire_date).toEqual('2024-01-01'); // Stored as string in DB
  });

  it('should handle nullable fields', async () => {
    const inputWithNulls: CreateUserInput = {
      email: 'null@example.com',
      password: 'password123',
      first_name: 'Null',
      last_name: 'User',
      role: 'employee',
      employee_id: null,
      department: null,
      hire_date: null
    };

    const result = await createUser(inputWithNulls);

    expect(result.employee_id).toBeNull();
    expect(result.department).toBeNull();
    expect(result.hire_date).toBeNull();
  });
});

describe('updateUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update user fields', async () => {
    const user = await createUser(testCreateInput);

    const updateInput: UpdateUserInput = {
      id: user.id,
      first_name: 'Updated John',
      department: 'Updated Engineering',
      is_active: false
    };

    const result = await updateUser(updateInput);

    expect(result.id).toEqual(user.id);
    expect(result.first_name).toEqual('Updated John');
    expect(result.department).toEqual('Updated Engineering');
    expect(result.is_active).toBe(false);
    expect(result.email).toEqual(user.email); // Unchanged
    expect(result.last_name).toEqual(user.last_name); // Unchanged
    expect(result.updated_at.getTime()).toBeGreaterThan(user.updated_at.getTime());
  });

  it('should update user in database', async () => {
    const user = await createUser(testCreateInput);

    const updateInput: UpdateUserInput = {
      id: user.id,
      role: 'admin',
      department: 'Management'
    };

    await updateUser(updateInput);

    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser[0].role).toEqual('admin');
    expect(updatedUser[0].department).toEqual('Management');
    expect(updatedUser[0].first_name).toEqual('John'); // Unchanged
  });

  it('should handle nullable field updates', async () => {
    const user = await createUser(testCreateInput);

    const updateInput: UpdateUserInput = {
      id: user.id,
      employee_id: null,
      department: null,
      hire_date: null
    };

    const result = await updateUser(updateInput);

    expect(result.employee_id).toBeNull();
    expect(result.department).toBeNull();
    expect(result.hire_date).toBeNull();
  });

  it('should update hire_date correctly', async () => {
    const user = await createUser(testCreateInput);
    const newHireDate = new Date('2025-02-01');

    const updateInput: UpdateUserInput = {
      id: user.id,
      hire_date: newHireDate
    };

    const result = await updateUser(updateInput);

    expect(result.hire_date).toEqual(newHireDate);

    // Check in database
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser[0].hire_date).toEqual('2025-02-01');
  });

  it('should throw error for non-existent user', async () => {
    const updateInput: UpdateUserInput = {
      id: 9999,
      first_name: 'Non-existent'
    };

    await expect(updateUser(updateInput)).rejects.toThrow(/user not found/i);
  });
});

describe('deleteUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete user', async () => {
    const user = await createUser(testCreateInput);

    const result = await deleteUser(user.id);

    expect(result.success).toBe(true);

    // Verify user is soft deleted
    const deletedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(deletedUser[0].is_active).toBe(false);
    expect(deletedUser[0].updated_at.getTime()).toBeGreaterThan(user.updated_at.getTime());
  });

  it('should throw error for non-existent user', async () => {
    await expect(deleteUser(9999)).rejects.toThrow(/user not found/i);
  });
});

describe('getAllUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all users', async () => {
    const user1 = await createUser(testCreateInput);
    const user2 = await createUser(testAdminInput);

    const result = await getAllUsers();

    expect(result).toHaveLength(2);
    expect(result.find(u => u.id === user1.id)).toBeDefined();
    expect(result.find(u => u.id === user2.id)).toBeDefined();
    
    // Verify date conversion
    result.forEach(user => {
      if (user.hire_date) {
        expect(user.hire_date).toBeInstanceOf(Date);
      }
    });
  });

  it('should return empty array when no users', async () => {
    const result = await getAllUsers();
    expect(result).toHaveLength(0);
  });

  it('should include inactive users', async () => {
    const user = await createUser(testCreateInput);
    await deleteUser(user.id); // Soft delete

    const result = await getAllUsers();

    expect(result).toHaveLength(1);
    expect(result[0].is_active).toBe(false);
  });
});

describe('getUserById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user by id', async () => {
    const user = await createUser(testCreateInput);

    const result = await getUserById(user.id);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(user.id);
    expect(result!.email).toEqual('test@example.com');
    expect(result!.first_name).toEqual('John');
    expect(result!.hire_date).toBeInstanceOf(Date);
    expect(result!.hire_date).toEqual(new Date('2024-01-01'));
  });

  it('should return null for non-existent user', async () => {
    const result = await getUserById(9999);
    expect(result).toBeNull();
  });

  it('should return inactive users', async () => {
    const user = await createUser(testCreateInput);
    await deleteUser(user.id); // Soft delete

    const result = await getUserById(user.id);

    expect(result).not.toBeNull();
    expect(result!.is_active).toBe(false);
  });

  it('should handle users with null hire_date', async () => {
    const inputWithNullDate: CreateUserInput = {
      ...testCreateInput,
      email: 'nulldate@example.com',
      hire_date: null
    };

    const user = await createUser(inputWithNullDate);
    const result = await getUserById(user.id);

    expect(result).not.toBeNull();
    expect(result!.hire_date).toBeNull();
  });
});
