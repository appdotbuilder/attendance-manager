
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type LoginResponse } from '../schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

// Simple password comparison (in production, use proper bcrypt)
function comparePassword(plaintext: string, hash: string): boolean {
  // For demo purposes, assume passwords are stored as plain text
  // In production, use bcrypt.compare(plaintext, hash)
  return plaintext === hash;
}

// Simple JWT creation (in production, use proper jsonwebtoken library)
function createToken(payload: { userId: number; email: string; role: string }): string {
  // For demo purposes, create a simple token
  // In production, use jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
  const tokenData = {
    ...payload,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isPasswordValid = comparePassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        employee_id: user.employee_id,
        department: user.department,
        hire_date: user.hire_date ? new Date(user.hire_date) : null,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function logout(): Promise<{ success: boolean }> {
  // In a real implementation, this would invalidate the token
  // For now, just return success since JWT tokens are stateless
  return { success: true };
}
