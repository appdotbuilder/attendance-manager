
import { serial, text, pgTable, timestamp, boolean, pgEnum, integer, numeric, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['employee', 'admin']);
export const leaveRequestStatusEnum = pgEnum('leave_request_status', ['pending', 'approved', 'rejected']);
export const leaveRequestTypeEnum = pgEnum('leave_request_type', ['vacation', 'sick', 'personal', 'emergency']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull(),
  employee_id: text('employee_id'),
  department: text('department'),
  hire_date: date('hire_date'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Attendance records table
export const attendanceRecordsTable = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  clock_in: timestamp('clock_in').notNull(),
  clock_out: timestamp('clock_out'),
  total_hours: numeric('total_hours', { precision: 5, scale: 2 }),
  date: date('date').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Leave requests table
export const leaveRequestsTable = pgTable('leave_requests', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  type: leaveRequestTypeEnum('type').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  reason: text('reason').notNull(),
  status: leaveRequestStatusEnum('status').notNull().default('pending'),
  approved_by: integer('approved_by').references(() => usersTable.id),
  approved_at: timestamp('approved_at'),
  rejection_reason: text('rejection_reason'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many, one }) => ({
  attendanceRecords: many(attendanceRecordsTable),
  leaveRequests: many(leaveRequestsTable),
  approvedLeaveRequests: many(leaveRequestsTable, { relationName: 'approver' }),
}));

export const attendanceRecordsRelations = relations(attendanceRecordsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [attendanceRecordsTable.user_id],
    references: [usersTable.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequestsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [leaveRequestsTable.user_id],
    references: [usersTable.id],
  }),
  approver: one(usersTable, {
    fields: [leaveRequestsTable.approved_by],
    references: [usersTable.id],
    relationName: 'approver',
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecordsTable.$inferInsert;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type NewLeaveRequest = typeof leaveRequestsTable.$inferInsert;

// Export all tables for proper query building
export const tables = { 
  users: usersTable, 
  attendanceRecords: attendanceRecordsTable,
  leaveRequests: leaveRequestsTable
};
