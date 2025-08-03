
import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['employee', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleSchema,
  employee_id: z.string().nullable(),
  department: z.string().nullable(),
  hire_date: z.coerce.date().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Attendance record schema
export const attendanceRecordSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  clock_in: z.coerce.date(),
  clock_out: z.coerce.date().nullable(),
  total_hours: z.number().nullable(),
  date: z.coerce.date(),
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

// Leave request status enum
export const leaveRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type LeaveRequestStatus = z.infer<typeof leaveRequestStatusSchema>;

// Leave request type enum
export const leaveRequestTypeSchema = z.enum(['vacation', 'sick', 'personal', 'emergency']);
export type LeaveRequestType = z.infer<typeof leaveRequestTypeSchema>;

// Leave request schema
export const leaveRequestSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: leaveRequestTypeSchema,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  reason: z.string(),
  status: leaveRequestStatusSchema,
  approved_by: z.number().nullable(),
  approved_at: z.coerce.date().nullable(),
  rejection_reason: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

// Input schemas for creating users
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: userRoleSchema,
  employee_id: z.string().nullable(),
  department: z.string().nullable(),
  hire_date: z.coerce.date().nullable()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

// Input schemas for updating users
export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  employee_id: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  hire_date: z.coerce.date().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Input schemas for clock in/out
export const clockInInputSchema = z.object({
  user_id: z.number(),
  notes: z.string().nullable().optional()
});

export type ClockInInput = z.infer<typeof clockInInputSchema>;

export const clockOutInputSchema = z.object({
  user_id: z.number(),
  notes: z.string().nullable().optional()
});

export type ClockOutInput = z.infer<typeof clockOutInputSchema>;

// Input schemas for leave requests
export const createLeaveRequestInputSchema = z.object({
  user_id: z.number(),
  type: leaveRequestTypeSchema,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  reason: z.string().min(1)
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestInputSchema>;

export const updateLeaveRequestStatusInputSchema = z.object({
  id: z.number(),
  status: leaveRequestStatusSchema,
  approved_by: z.number(),
  rejection_reason: z.string().nullable().optional()
});

export type UpdateLeaveRequestStatusInput = z.infer<typeof updateLeaveRequestStatusInputSchema>;

// Query input schemas
export const getUserAttendanceInputSchema = z.object({
  user_id: z.number(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional()
});

export type GetUserAttendanceInput = z.infer<typeof getUserAttendanceInputSchema>;

export const getAttendanceReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  department: z.string().nullable().optional(),
  user_id: z.number().optional()
});

export type GetAttendanceReportInput = z.infer<typeof getAttendanceReportInputSchema>;

// Authentication input schema
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Response schemas
export const loginResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
