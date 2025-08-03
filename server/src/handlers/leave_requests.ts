
import { db } from '../db';
import { leaveRequestsTable, usersTable } from '../db/schema';
import { type CreateLeaveRequestInput, type UpdateLeaveRequestStatusInput, type LeaveRequest } from '../schema';
import { eq, and, desc } from 'drizzle-orm';

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  try {
    // Validate that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Validate date range
    if (input.start_date > input.end_date) {
      throw new Error('Start date must be before or equal to end date');
    }

    // Insert leave request record - convert dates to strings
    const result = await db.insert(leaveRequestsTable)
      .values({
        user_id: input.user_id,
        type: input.type,
        start_date: input.start_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        end_date: input.end_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        reason: input.reason,
        status: 'pending' // Default status
      })
      .returning()
      .execute();

    // Convert string dates back to Date objects
    const leaveRequest = result[0];
    return {
      ...leaveRequest,
      start_date: new Date(leaveRequest.start_date),
      end_date: new Date(leaveRequest.end_date)
    };
  } catch (error) {
    console.error('Leave request creation failed:', error);
    throw error;
  }
}

export async function updateLeaveRequestStatus(input: UpdateLeaveRequestStatusInput): Promise<LeaveRequest> {
  try {
    // Validate that the leave request exists
    const existingRequest = await db.select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.id, input.id))
      .execute();

    if (existingRequest.length === 0) {
      throw new Error('Leave request not found');
    }

    // Validate that the approver exists
    const approver = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.approved_by))
      .execute();

    if (approver.length === 0) {
      throw new Error('Approver not found');
    }

    // Update leave request status
    const updateData: any = {
      status: input.status,
      approved_by: input.approved_by,
      approved_at: input.status === 'approved' ? new Date() : null,
      rejection_reason: input.rejection_reason || null
    };

    const result = await db.update(leaveRequestsTable)
      .set(updateData)
      .where(eq(leaveRequestsTable.id, input.id))
      .returning()
      .execute();

    // Convert string dates back to Date objects
    const leaveRequest = result[0];
    return {
      ...leaveRequest,
      start_date: new Date(leaveRequest.start_date),
      end_date: new Date(leaveRequest.end_date)
    };
  } catch (error) {
    console.error('Leave request status update failed:', error);
    throw error;
  }
}

export async function getUserLeaveRequests(userId: number): Promise<LeaveRequest[]> {
  try {
    // Validate that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Fetch user's leave requests ordered by creation date (most recent first)
    const results = await db.select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.user_id, userId))
      .orderBy(desc(leaveRequestsTable.created_at))
      .execute();

    // Convert string dates back to Date objects
    return results.map(request => ({
      ...request,
      start_date: new Date(request.start_date),
      end_date: new Date(request.end_date)
    }));
  } catch (error) {
    console.error('Failed to fetch user leave requests:', error);
    throw error;
  }
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    // Fetch all leave requests ordered by creation date (most recent first)
    const results = await db.select()
      .from(leaveRequestsTable)
      .orderBy(desc(leaveRequestsTable.created_at))
      .execute();

    // Convert string dates back to Date objects
    return results.map(request => ({
      ...request,
      start_date: new Date(request.start_date),
      end_date: new Date(request.end_date)
    }));
  } catch (error) {
    console.error('Failed to fetch all leave requests:', error);
    throw error;
  }
}

export async function getPendingLeaveRequests(): Promise<LeaveRequest[]> {
  try {
    // Fetch all pending leave requests ordered by creation date (most recent first)
    const results = await db.select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.status, 'pending'))
      .orderBy(desc(leaveRequestsTable.created_at))
      .execute();

    // Convert string dates back to Date objects
    return results.map(request => ({
      ...request,
      start_date: new Date(request.start_date),
      end_date: new Date(request.end_date)
    }));
  } catch (error) {
    console.error('Failed to fetch pending leave requests:', error);
    throw error;
  }
}

export async function deleteLeaveRequest(requestId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Validate that the leave request exists and belongs to the user
    const existingRequest = await db.select()
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.id, requestId),
          eq(leaveRequestsTable.user_id, userId)
        )
      )
      .execute();

    if (existingRequest.length === 0) {
      throw new Error('Leave request not found or does not belong to user');
    }

    // Check if request is still pending (only pending requests can be deleted)
    if (existingRequest[0].status !== 'pending') {
      throw new Error('Only pending leave requests can be deleted');
    }

    // Delete the leave request
    await db.delete(leaveRequestsTable)
      .where(eq(leaveRequestsTable.id, requestId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Leave request deletion failed:', error);
    throw error;
  }
}
