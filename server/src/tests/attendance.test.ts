
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, attendanceRecordsTable } from '../db/schema';
import { type ClockInInput, type ClockOutInput, type GetUserAttendanceInput } from '../schema';
import { clockIn, clockOut, getUserAttendance, getAllAttendance, getTodayAttendanceStatus } from '../handlers/attendance';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  role: 'employee' as const,
  employee_id: 'EMP001',
  department: 'Engineering',
  hire_date: '2023-01-01',
  is_active: true
};

describe('Attendance Handlers', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;
  });

  afterEach(resetDB);

  describe('clockIn', () => {
    it('should create clock-in record', async () => {
      const input: ClockInInput = {
        user_id: userId,
        notes: 'Starting work'
      };
      
      const result = await clockIn(input);

      expect(result.user_id).toEqual(userId);
      expect(result.clock_in).toBeInstanceOf(Date);
      expect(result.clock_out).toBeNull();
      expect(result.total_hours).toBeNull();
      expect(result.notes).toEqual('Starting work');
      expect(result.id).toBeDefined();
      expect(result.date).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save clock-in record to database', async () => {
      const input: ClockInInput = {
        user_id: userId,
        notes: 'Starting work'
      };
      
      const result = await clockIn(input);

      const records = await db.select()
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.id, result.id))
        .execute();

      expect(records).toHaveLength(1);
      expect(records[0].user_id).toEqual(userId);
      expect(records[0].clock_in).toBeInstanceOf(Date);
      expect(records[0].clock_out).toBeNull();
      expect(records[0].notes).toEqual('Starting work');
    });

    it('should prevent double clock-in on same day', async () => {
      const input: ClockInInput = {
        user_id: userId,
        notes: 'Starting work'
      };
      
      // First clock in should succeed
      await clockIn(input);

      // Second clock in should fail
      await expect(clockIn(input)).rejects.toThrow(/already clocked in today/i);
    });

    it('should throw error for non-existent user', async () => {
      const input: ClockInInput = {
        user_id: 99999,
        notes: 'Starting work'
      };
      
      await expect(clockIn(input)).rejects.toThrow(/user not found/i);
    });
  });

  describe('clockOut', () => {
    it('should update record with clock-out time and calculate hours', async () => {
      // First clock in
      const clockInData: ClockInInput = { user_id: userId, notes: 'Starting work' };
      await clockIn(clockInData);

      // Add a small delay to ensure measurable time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then clock out
      const clockOutData: ClockOutInput = {
        user_id: userId,
        notes: 'End of workday'
      };
      
      const result = await clockOut(clockOutData);

      expect(result.user_id).toEqual(userId);
      expect(result.clock_in).toBeInstanceOf(Date);
      expect(result.clock_out).toBeInstanceOf(Date);
      expect(typeof result.total_hours).toBe('number');
      expect(result.total_hours).toBeGreaterThanOrEqual(0);
      expect(result.notes).toEqual('End of workday');
      expect(result.date).toBeInstanceOf(Date);
    });

    it('should save updated record to database', async () => {
      // First clock in
      await clockIn({ user_id: userId, notes: 'Starting work' });

      // Add a small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then clock out
      const clockOutData: ClockOutInput = {
        user_id: userId,
        notes: 'End of workday'
      };
      
      const result = await clockOut(clockOutData);

      const records = await db.select()
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.id, result.id))
        .execute();

      expect(records).toHaveLength(1);
      expect(records[0].clock_out).toBeInstanceOf(Date);
      expect(records[0].total_hours).toBeDefined();
      expect(parseFloat(records[0].total_hours!)).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when no clock-in record exists', async () => {
      const input: ClockOutInput = {
        user_id: userId,
        notes: 'End of workday'
      };
      
      await expect(clockOut(input)).rejects.toThrow(/no clock-in record found/i);
    });

    it('should prevent double clock-out', async () => {
      // Clock in first
      await clockIn({ user_id: userId, notes: 'Starting work' });

      const input: ClockOutInput = {
        user_id: userId,
        notes: 'End of workday'
      };
      
      // First clock out should succeed
      await clockOut(input);

      // Second clock out should fail
      await expect(clockOut(input)).rejects.toThrow(/already clocked out today/i);
    });

    it('should throw error for non-existent user', async () => {
      const input: ClockOutInput = {
        user_id: 99999,
        notes: 'End of workday'
      };
      
      await expect(clockOut(input)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getUserAttendance', () => {
    it('should return user attendance records', async () => {
      // Create attendance record
      await clockIn({ user_id: userId, notes: 'Work start' });
      await clockOut({ user_id: userId, notes: 'Work end' });

      const input: GetUserAttendanceInput = { user_id: userId };
      const results = await getUserAttendance(input);

      expect(results).toHaveLength(1);
      expect(results[0].user_id).toEqual(userId);
      expect(results[0].clock_in).toBeInstanceOf(Date);
      expect(results[0].clock_out).toBeInstanceOf(Date);
      expect(results[0].date).toBeInstanceOf(Date);
      expect(typeof results[0].total_hours).toBe('number');
    });

    it('should filter by date range', async () => {
      // Create attendance record
      await clockIn({ user_id: userId, notes: 'Work start' });
      await clockOut({ user_id: userId, notes: 'Work end' });

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const input: GetUserAttendanceInput = {
        user_id: userId,
        start_date: today,
        end_date: tomorrow
      };

      const results = await getUserAttendance(input);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(record => {
        expect(record.user_id).toEqual(userId);
        expect(record.date).toBeInstanceOf(Date);
      });
    });

    it('should return empty array for user with no records', async () => {
      const input: GetUserAttendanceInput = { user_id: userId };
      const results = await getUserAttendance(input);
      
      expect(results).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      const input: GetUserAttendanceInput = { user_id: 99999 };
      
      await expect(getUserAttendance(input)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getAllAttendance', () => {
    it('should return all attendance records', async () => {
      // Create attendance records for test user
      await clockIn({ user_id: userId, notes: 'Work start' });
      await clockOut({ user_id: userId, notes: 'Work end' });

      const results = await getAllAttendance();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].user_id).toEqual(userId);
      expect(results[0].clock_in).toBeInstanceOf(Date);
      expect(results[0].clock_out).toBeInstanceOf(Date);
      expect(results[0].date).toBeInstanceOf(Date);
      expect(typeof results[0].total_hours).toBe('number');
    });

    it('should return empty array when no records exist', async () => {
      const results = await getAllAttendance();
      expect(results).toHaveLength(0);
    });
  });

  describe('getTodayAttendanceStatus', () => {
    it('should return false status when no record exists', async () => {
      const result = await getTodayAttendanceStatus(userId);

      expect(result.hasClockedIn).toBe(false);
      expect(result.hasClockedOut).toBe(false);
      expect(result.currentRecord).toBeNull();
    });

    it('should return clocked in status', async () => {
      await clockIn({ user_id: userId, notes: 'Work start' });

      const result = await getTodayAttendanceStatus(userId);

      expect(result.hasClockedIn).toBe(true);
      expect(result.hasClockedOut).toBe(false);
      expect(result.currentRecord).not.toBeNull();
      expect(result.currentRecord!.user_id).toEqual(userId);
      expect(result.currentRecord!.clock_out).toBeNull();
      expect(result.currentRecord!.date).toBeInstanceOf(Date);
    });

    it('should return clocked out status', async () => {
      await clockIn({ user_id: userId, notes: 'Work start' });
      await clockOut({ user_id: userId, notes: 'Work end' });

      const result = await getTodayAttendanceStatus(userId);

      expect(result.hasClockedIn).toBe(true);
      expect(result.hasClockedOut).toBe(true);
      expect(result.currentRecord).not.toBeNull();
      expect(result.currentRecord!.user_id).toEqual(userId);
      expect(result.currentRecord!.clock_out).toBeInstanceOf(Date);
      expect(result.currentRecord!.date).toBeInstanceOf(Date);
      expect(typeof result.currentRecord!.total_hours).toBe('number');
    });

    it('should throw error for non-existent user', async () => {
      await expect(getTodayAttendanceStatus(99999)).rejects.toThrow(/user not found/i);
    });
  });
});
