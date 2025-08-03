
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Simple password hashing (in production, use bcrypt or similar)
    const password_hash = `hashed_${input.password}`;

    // Insert user record - convert Date to string for date column
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role,
        employee_id: input.employee_id,
        department: input.department,
        hire_date: input.hire_date ? input.hire_date.toISOString().split('T')[0] : null
      })
      .returning()
      .execute();

    // Convert hire_date from string to Date if not null
    const user = result[0];
    return {
      ...user,
      hire_date: user.hire_date ? new Date(user.hire_date) : null
    };
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Build update data, excluding undefined values
    const updateData: any = {};
    
    if (input.email !== undefined) updateData.email = input.email;
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.employee_id !== undefined) updateData.employee_id = input.employee_id;
    if (input.department !== undefined) updateData.department = input.department;
    if (input.hire_date !== undefined) {
      updateData.hire_date = input.hire_date ? input.hire_date.toISOString().split('T')[0] : null;
    }
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Update user record
    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    // Convert hire_date from string to Date if not null
    const user = result[0];
    return {
      ...user,
      hire_date: user.hire_date ? new Date(user.hire_date) : null
    };
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
}

export async function deleteUser(userId: number): Promise<{ success: boolean }> {
  try {
    // Soft delete by setting is_active to false
    const result = await db.update(usersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const result = await db.select()
      .from(usersTable)
      .execute();

    // Convert hire_date from string to Date if not null for each user
    return result.map(user => ({
      ...user,
      hire_date: user.hire_date ? new Date(user.hire_date) : null
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(userId: number): Promise<User | null> {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Convert hire_date from string to Date if not null
    const user = result[0];
    return {
      ...user,
      hire_date: user.hire_date ? new Date(user.hire_date) : null
    };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}
