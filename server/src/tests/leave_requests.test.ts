
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, leaveRequestsTable } from '../db/schema';
import { type CreateLeaveRequestInput, type UpdateLeaveRequestStatusInput } from '../schema';
import { 
  createLeaveRequest, 
  updateLeaveRequestStatus, 
  getUserLeaveRequests, 
  getAllLeaveRequests, 
  getPendingLeaveRequests,
  deleteLeaveRequest 
} from '../handlers/leave_requests';
import { eq, and } from 'drizzle-orm';

// Test users - convert Date to string for hire_date
const testUser = {
  email: 'employee@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  role: 'employee' as const,
  employee_id: 'EMP001',
  department: 'Engineering',
  hire_date: '2023-01-01' // String format for date column
};

const testAdmin = {
  email: 'admin@test.com',
  password_hash: 'hashed_password',
  first_name: 'Jane',
  last_name: 'Admin',
  role: 'admin' as const,
  employee_id: 'ADM001',
  department: 'Management',
  hire_date: '2022-01-01' // String format for date column
};

// Test leave request input
const testLeaveRequest: CreateLeaveRequestInput = {
  user_id: 1, // Will be set after user creation
  type: 'vacation',
  start_date: new Date('2024-01-15'),
  end_date: new Date('2024-01-20'),
  reason: 'Family vacation'
};

describe('Leave Request Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createLeaveRequest', () => {
    it('should create a leave request', async () => {
      // Create test user first
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      const input = { ...testLeaveRequest, user_id: userId };
      const result = await createLeaveRequest(input);

      expect(result.user_id).toEqual(userId);
      expect(result.type).toEqual('vacation');
      expect(result.start_date).toEqual(new Date('2024-01-15'));
      expect(result.end_date).toEqual(new Date('2024-01-20'));
      expect(result.reason).toEqual('Family vacation');
      expect(result.status).toEqual('pending');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.approved_by).toBeNull();
      expect(result.approved_at).toBeNull();
    });

    it('should save leave request to database', async () => {
      // Create test user first
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      const input = { ...testLeaveRequest, user_id: userId };
      const result = await createLeaveRequest(input);

      const leaveRequests = await db.select()
        .from(leaveRequestsTable)
        .where(eq(leaveRequestsTable.id, result.id))
        .execute();

      expect(leaveRequests).toHaveLength(1);
      expect(leaveRequests[0].user_id).toEqual(userId);
      expect(leaveRequests[0].type).toEqual('vacation');
      expect(leaveRequests[0].status).toEqual('pending');
    });

    it('should throw error for non-existent user', async () => {
      const input = { ...testLeaveRequest, user_id: 999 };
      
      expect(createLeaveRequest(input)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for invalid date range', async () => {
      // Create test user first
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      const input = {
        ...testLeaveRequest,
        user_id: userId,
        start_date: new Date('2024-01-20'),
        end_date: new Date('2024-01-15') // End date before start date
      };

      expect(createLeaveRequest(input)).rejects.toThrow(/start date must be before or equal to end date/i);
    });
  });

  describe('updateLeaveRequestStatus', () => {
    it('should approve a leave request', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId = users[0].id;
      const adminId = users[1].id;

      // Create leave request
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId });

      const input: UpdateLeaveRequestStatusInput = {
        id: leaveRequest.id,
        status: 'approved',
        approved_by: adminId
      };

      const result = await updateLeaveRequestStatus(input);

      expect(result.status).toEqual('approved');
      expect(result.approved_by).toEqual(adminId);
      expect(result.approved_at).toBeInstanceOf(Date);
      expect(result.rejection_reason).toBeNull();
    });

    it('should reject a leave request with reason', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId = users[0].id;
      const adminId = users[1].id;

      // Create leave request
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId });

      const input: UpdateLeaveRequestStatusInput = {
        id: leaveRequest.id,
        status: 'rejected',
        approved_by: adminId,
        rejection_reason: 'Insufficient leave balance'
      };

      const result = await updateLeaveRequestStatus(input);

      expect(result.status).toEqual('rejected');
      expect(result.approved_by).toEqual(adminId);
      expect(result.approved_at).toBeNull();
      expect(result.rejection_reason).toEqual('Insufficient leave balance');
    });

    it('should throw error for non-existent leave request', async () => {
      // Create test admin
      const admins = await db.insert(usersTable)
        .values(testAdmin)
        .returning()
        .execute();
      const adminId = admins[0].id;

      const input: UpdateLeaveRequestStatusInput = {
        id: 999,
        status: 'approved',
        approved_by: adminId
      };

      expect(updateLeaveRequestStatus(input)).rejects.toThrow(/leave request not found/i);
    });

    it('should throw error for non-existent approver', async () => {
      // Create test user
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      // Create leave request
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId });

      const input: UpdateLeaveRequestStatusInput = {
        id: leaveRequest.id,
        status: 'approved',
        approved_by: 999
      };

      expect(updateLeaveRequestStatus(input)).rejects.toThrow(/approver not found/i);
    });
  });

  describe('getUserLeaveRequests', () => {
    it('should return user leave requests ordered by creation date', async () => {
      // Create test user
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      // Create multiple leave requests
      await createLeaveRequest({ ...testLeaveRequest, user_id: userId, reason: 'First request' });
      await createLeaveRequest({ 
        ...testLeaveRequest, 
        user_id: userId, 
        type: 'sick',
        reason: 'Second request'
      });

      const results = await getUserLeaveRequests(userId);

      expect(results).toHaveLength(2);
      expect(results[0].reason).toEqual('Second request'); // Most recent first
      expect(results[1].reason).toEqual('First request');
      expect(results.every(req => req.user_id === userId)).toBe(true);
    });

    it('should return empty array for user with no leave requests', async () => {
      // Create test user
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      const results = await getUserLeaveRequests(userId);

      expect(results).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      expect(getUserLeaveRequests(999)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getAllLeaveRequests', () => {
    it('should return all leave requests ordered by creation date', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId1 = users[0].id;
      const userId2 = users[1].id;

      // Create leave requests for different users
      await createLeaveRequest({ ...testLeaveRequest, user_id: userId1, reason: 'User 1 request' });
      await createLeaveRequest({ ...testLeaveRequest, user_id: userId2, reason: 'User 2 request' });

      const results = await getAllLeaveRequests();

      expect(results).toHaveLength(2);
      expect(results[0].reason).toEqual('User 2 request'); // Most recent first
      expect(results[1].reason).toEqual('User 1 request');
    });

    it('should return empty array when no leave requests exist', async () => {
      const results = await getAllLeaveRequests();

      expect(results).toHaveLength(0);
    });
  });

  describe('getPendingLeaveRequests', () => {
    it('should return only pending leave requests', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId = users[0].id;
      const adminId = users[1].id;

      // Create leave requests with different statuses
      const pendingRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId, reason: 'Pending request' });
      const approvedRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId, reason: 'Will be approved' });

      // Approve one request
      await updateLeaveRequestStatus({
        id: approvedRequest.id,
        status: 'approved',
        approved_by: adminId
      });

      const results = await getPendingLeaveRequests();

      expect(results).toHaveLength(1);
      expect(results[0].reason).toEqual('Pending request');
      expect(results[0].status).toEqual('pending');
    });

    it('should return empty array when no pending requests exist', async () => {
      const results = await getPendingLeaveRequests();

      expect(results).toHaveLength(0);
    });
  });

  describe('deleteLeaveRequest', () => {
    it('should delete pending leave request owned by user', async () => {
      // Create test user
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      // Create leave request
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId });

      const result = await deleteLeaveRequest(leaveRequest.id, userId);

      expect(result.success).toBe(true);

      // Verify deletion
      const remainingRequests = await db.select()
        .from(leaveRequestsTable)
        .where(eq(leaveRequestsTable.id, leaveRequest.id))
        .execute();

      expect(remainingRequests).toHaveLength(0);
    });

    it('should throw error for non-existent leave request', async () => {
      // Create test user
      const users = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      const userId = users[0].id;

      expect(deleteLeaveRequest(999, userId)).rejects.toThrow(/leave request not found or does not belong to user/i);
    });

    it('should throw error when user tries to delete another user request', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId1 = users[0].id;
      const userId2 = users[1].id;

      // Create leave request for user1
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId1 });

      // Try to delete as user2
      expect(deleteLeaveRequest(leaveRequest.id, userId2)).rejects.toThrow(/leave request not found or does not belong to user/i);
    });

    it('should throw error for non-pending leave request', async () => {
      // Create test users
      const users = await db.insert(usersTable)
        .values([testUser, testAdmin])
        .returning()
        .execute();
      const userId = users[0].id;
      const adminId = users[1].id;

      // Create and approve leave request
      const leaveRequest = await createLeaveRequest({ ...testLeaveRequest, user_id: userId });
      await updateLeaveRequestStatus({
        id: leaveRequest.id,
        status: 'approved',
        approved_by: adminId
      });

      expect(deleteLeaveRequest(leaveRequest.id, userId)).rejects.toThrow(/only pending leave requests can be deleted/i);
    });
  });
});
