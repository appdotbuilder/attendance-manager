
import { db } from '../db';
import { attendanceRecordsTable, usersTable } from '../db/schema';
import { type ClockInInput, type ClockOutInput, type AttendanceRecord, type GetUserAttendanceInput } from '../schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export async function clockIn(input: ClockInInput): Promise<AttendanceRecord> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Check if user has already clocked in today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const existingRecord = await db.select()
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.user_id, input.user_id),
        eq(attendanceRecordsTable.date, startOfDay.toISOString().split('T')[0])
      ))
      .execute();

    if (existingRecord.length > 0) {
      throw new Error('User has already clocked in today');
    }

    // Create new attendance record
    const clockInTime = new Date();
    const result = await db.insert(attendanceRecordsTable)
      .values({
        user_id: input.user_id,
        clock_in: clockInTime,
        clock_out: null,
        total_hours: null,
        date: startOfDay.toISOString().split('T')[0],
        notes: input.notes || null
      })
      .returning()
      .execute();

    const record = result[0];
    return {
      ...record,
      date: new Date(record.date),
      total_hours: record.total_hours ? parseFloat(record.total_hours) : null
    };
  } catch (error) {
    console.error('Clock in failed:', error);
    throw error;
  }
}

export async function clockOut(input: ClockOutInput): Promise<AttendanceRecord> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Find today's attendance record
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const existingRecord = await db.select()
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.user_id, input.user_id),
        eq(attendanceRecordsTable.date, startOfDay.toISOString().split('T')[0])
      ))
      .execute();

    if (existingRecord.length === 0) {
      throw new Error('No clock-in record found for today');
    }

    const record = existingRecord[0];
    if (record.clock_out) {
      throw new Error('User has already clocked out today');
    }

    // Calculate total hours
    const clockOutTime = new Date();
    const clockInTime = new Date(record.clock_in);
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    // Update record with clock out time and total hours
    const result = await db.update(attendanceRecordsTable)
      .set({
        clock_out: clockOutTime,
        total_hours: totalHours.toString(),
        notes: input.notes || record.notes,
        updated_at: new Date()
      })
      .where(eq(attendanceRecordsTable.id, record.id))
      .returning()
      .execute();

    const updatedRecord = result[0];
    return {
      ...updatedRecord,
      date: new Date(updatedRecord.date),
      total_hours: updatedRecord.total_hours ? parseFloat(updatedRecord.total_hours) : null
    };
  } catch (error) {
    console.error('Clock out failed:', error);
    throw error;
  }
}

export async function getUserAttendance(input: GetUserAttendanceInput): Promise<AttendanceRecord[]> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Build conditions array
    const conditions: SQL<unknown>[] = [eq(attendanceRecordsTable.user_id, input.user_id)];

    if (input.start_date) {
      conditions.push(gte(attendanceRecordsTable.date, input.start_date.toISOString().split('T')[0]));
    }

    if (input.end_date) {
      conditions.push(lte(attendanceRecordsTable.date, input.end_date.toISOString().split('T')[0]));
    }

    // Execute query with proper condition handling
    const results = await db.select()
      .from(attendanceRecordsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(attendanceRecordsTable.date))
      .execute();

    return results.map(record => ({
      ...record,
      date: new Date(record.date),
      total_hours: record.total_hours ? parseFloat(record.total_hours) : null
    }));
  } catch (error) {
    console.error('Get user attendance failed:', error);
    throw error;
  }
}

export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  try {
    const results = await db.select()
      .from(attendanceRecordsTable)
      .orderBy(desc(attendanceRecordsTable.date))
      .execute();

    return results.map(record => ({
      ...record,
      date: new Date(record.date),
      total_hours: record.total_hours ? parseFloat(record.total_hours) : null
    }));
  } catch (error) {
    console.error('Get all attendance failed:', error);
    throw error;
  }
}

export async function getTodayAttendanceStatus(userId: number): Promise<{ 
  hasClockedIn: boolean; 
  hasClockedOut: boolean; 
  currentRecord: AttendanceRecord | null 
}> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get today's attendance record
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const records = await db.select()
      .from(attendanceRecordsTable)
      .where(and(
        eq(attendanceRecordsTable.user_id, userId),
        eq(attendanceRecordsTable.date, startOfDay.toISOString().split('T')[0])
      ))
      .execute();

    if (records.length === 0) {
      return {
        hasClockedIn: false,
        hasClockedOut: false,
        currentRecord: null
      };
    }

    const record = records[0];
    const attendanceRecord = {
      ...record,
      date: new Date(record.date),
      total_hours: record.total_hours ? parseFloat(record.total_hours) : null
    };

    return {
      hasClockedIn: true,
      hasClockedOut: !!record.clock_out,
      currentRecord: attendanceRecord
    };
  } catch (error) {
    console.error('Get today attendance status failed:', error);
    throw error;
  }
}
