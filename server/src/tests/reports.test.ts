
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, attendanceRecordsTable, leaveRequestsTable } from '../db/schema';
import { 
    generateAttendanceReport, 
    getDepartmentSummary, 
    getLeaveRequestsSummary,
    type AttendanceReportData,
    type DepartmentSummary,
    type LeaveRequestsSummary
} from '../handlers/reports';
import { type GetAttendanceReportInput } from '../schema';

describe('Reports Handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    describe('generateAttendanceReport', () => {
        it('should generate attendance report for all users', async () => {
            // Create test users
            const users = await db.insert(usersTable).values([
                {
                    email: 'john@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'John',
                    last_name: 'Doe',
                    role: 'employee',
                    department: 'Engineering',
                    employee_id: 'EMP001',
                    is_active: true
                },
                {
                    email: 'jane@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Jane',
                    last_name: 'Smith',
                    role: 'employee',
                    department: 'HR',
                    employee_id: 'EMP002',
                    is_active: true
                }
            ]).returning().execute();

            // Create attendance records
            await db.insert(attendanceRecordsTable).values([
                {
                    user_id: users[0].id,
                    clock_in: new Date('2024-01-15T09:30:00'),
                    clock_out: new Date('2024-01-15T17:30:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                },
                {
                    user_id: users[0].id,
                    clock_in: new Date('2024-01-16T08:00:00'),
                    clock_out: new Date('2024-01-16T16:30:00'),
                    total_hours: '8.50',
                    date: '2024-01-16'
                },
                {
                    user_id: users[1].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T17:00:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                }
            ]).execute();

            const input: GetAttendanceReportInput = {
                start_date: new Date('2024-01-15'),
                end_date: new Date('2024-01-16')
            };

            const report = await generateAttendanceReport(input);

            expect(report).toHaveLength(2);
            
            // Check John Doe's data
            const johnData = report.find(r => r.employeeName === 'John Doe');
            expect(johnData).toBeDefined();
            expect(johnData!.userId).toBe(users[0].id);
            expect(johnData!.department).toBe('Engineering');
            expect(johnData!.totalDays).toBe(2);
            expect(johnData!.totalHours).toBe(16.5);
            expect(johnData!.averageHoursPerDay).toBe(8.25);
            expect(johnData!.lateArrivals).toBe(1); // 09:30 arrival
            expect(johnData!.earlyDepartures).toBe(1); // 16:30 departure

            // Check Jane Smith's data
            const janeData = report.find(r => r.employeeName === 'Jane Smith');
            expect(janeData).toBeDefined();
            expect(janeData!.userId).toBe(users[1].id);
            expect(janeData!.department).toBe('HR');
            expect(janeData!.totalDays).toBe(1);
            expect(janeData!.totalHours).toBe(8);
            expect(janeData!.averageHoursPerDay).toBe(8);
            expect(janeData!.lateArrivals).toBe(0);
            expect(janeData!.earlyDepartures).toBe(0);
        });

        it('should filter by department', async () => {
            // Create users in different departments
            const users = await db.insert(usersTable).values([
                {
                    email: 'eng@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Engineer',
                    last_name: 'One',
                    role: 'employee',
                    department: 'Engineering',
                    employee_id: 'ENG001',
                    is_active: true
                },
                {
                    email: 'hr@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'HR',
                    last_name: 'Person',
                    role: 'employee',
                    department: 'HR',
                    employee_id: 'HR001',
                    is_active: true
                }
            ]).returning().execute();

            // Create attendance for both
            await db.insert(attendanceRecordsTable).values([
                {
                    user_id: users[0].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T17:00:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                },
                {
                    user_id: users[1].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T17:00:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                }
            ]).execute();

            const input: GetAttendanceReportInput = {
                start_date: new Date('2024-01-15'),
                end_date: new Date('2024-01-15'),
                department: 'Engineering'
            };

            const report = await generateAttendanceReport(input);

            expect(report).toHaveLength(1);
            expect(report[0].employeeName).toBe('Engineer One');
            expect(report[0].department).toBe('Engineering');
        });

        it('should filter by specific user', async () => {
            // Create test user
            const user = await db.insert(usersTable).values({
                email: 'test@example.com',
                password_hash: 'hashedpassword123',
                first_name: 'Test',
                last_name: 'User',
                role: 'employee',
                department: 'IT',
                employee_id: 'TEST001',
                is_active: true
            }).returning().execute();

            await db.insert(attendanceRecordsTable).values({
                user_id: user[0].id,
                clock_in: new Date('2024-01-15T09:00:00'),
                clock_out: new Date('2024-01-15T17:00:00'),
                total_hours: '8.00',
                date: '2024-01-15'
            }).execute();

            const input: GetAttendanceReportInput = {
                start_date: new Date('2024-01-15'),
                end_date: new Date('2024-01-15'),
                user_id: user[0].id
            };

            const report = await generateAttendanceReport(input);

            expect(report).toHaveLength(1);
            expect(report[0].userId).toBe(user[0].id);
            expect(report[0].employeeName).toBe('Test User');
        });

        it('should return empty array when no attendance records exist', async () => {
            const input: GetAttendanceReportInput = {
                start_date: new Date('2024-01-15'),
                end_date: new Date('2024-01-15')
            };

            const report = await generateAttendanceReport(input);

            expect(report).toHaveLength(0);
        });
    });

    describe('getDepartmentSummary', () => {
        it('should generate department summary', async () => {
            // Create users in different departments
            const users = await db.insert(usersTable).values([
                {
                    email: 'eng1@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Engineer',
                    last_name: 'One',
                    role: 'employee',
                    department: 'Engineering',
                    employee_id: 'ENG001',
                    is_active: true
                },
                {
                    email: 'eng2@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Engineer',
                    last_name: 'Two',
                    role: 'employee',
                    department: 'Engineering',
                    employee_id: 'ENG002',
                    is_active: true
                },
                {
                    email: 'hr1@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'HR',
                    last_name: 'Person',
                    role: 'employee',
                    department: 'HR',
                    employee_id: 'HR001',
                    is_active: true
                }
            ]).returning().execute();

            // Create attendance records
            await db.insert(attendanceRecordsTable).values([
                {
                    user_id: users[0].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T17:00:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                },
                {
                    user_id: users[1].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T18:00:00'),
                    total_hours: '9.00',
                    date: '2024-01-15'
                },
                {
                    user_id: users[2].id,
                    clock_in: new Date('2024-01-15T09:00:00'),
                    clock_out: new Date('2024-01-15T17:00:00'),
                    total_hours: '8.00',
                    date: '2024-01-15'
                }
            ]).execute();

            const startDate = new Date('2024-01-15');
            const endDate = new Date('2024-01-15');

            const summary = await getDepartmentSummary(startDate, endDate);

            expect(summary).toHaveLength(2);

            // Check Engineering department
            const engSummary = summary.find(s => s.department === 'Engineering');
            expect(engSummary).toBeDefined();
            expect(engSummary!.totalEmployees).toBe(2);
            expect(engSummary!.averageHoursPerDay).toBe(8.5); // (8 + 9) / 2
            expect(engSummary!.attendanceRate).toBe(100); // Both employees attended

            // Check HR department
            const hrSummary = summary.find(s => s.department === 'HR');
            expect(hrSummary).toBeDefined();
            expect(hrSummary!.totalEmployees).toBe(1);
            expect(hrSummary!.averageHoursPerDay).toBe(8);
            expect(hrSummary!.attendanceRate).toBe(100);
        });

        it('should exclude users without departments', async () => {
            // Create user without department
            const user = await db.insert(usersTable).values({
                email: 'nodept@example.com',
                password_hash: 'hashedpassword123',
                first_name: 'No',
                last_name: 'Department',
                role: 'employee',
                department: null,
                employee_id: 'NODEPT001',
                is_active: true
            }).returning().execute();

            await db.insert(attendanceRecordsTable).values({
                user_id: user[0].id,
                clock_in: new Date('2024-01-15T09:00:00'),
                clock_out: new Date('2024-01-15T17:00:00'),
                total_hours: '8.00',
                date: '2024-01-15'
            }).execute();

            const startDate = new Date('2024-01-15');
            const endDate = new Date('2024-01-15');

            const summary = await getDepartmentSummary(startDate, endDate);

            expect(summary).toHaveLength(0);
        });

        it('should calculate attendance rate correctly with missing attendance', async () => {
            // Create users in same department
            const users = await db.insert(usersTable).values([
                {
                    email: 'emp1@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Employee',
                    last_name: 'One',
                    role: 'employee',
                    department: 'Sales',
                    employee_id: 'SALES001',
                    is_active: true
                },
                {
                    email: 'emp2@example.com',
                    password_hash: 'hashedpassword123',
                    first_name: 'Employee',
                    last_name: 'Two',
                    role: 'employee',
                    department: 'Sales',
                    employee_id: 'SALES002',
                    is_active: true
                }
            ]).returning().execute();

            // Only one employee has attendance record
            await db.insert(attendanceRecordsTable).values({
                user_id: users[0].id,
                clock_in: new Date('2024-01-15T09:00:00'),
                clock_out: new Date('2024-01-15T17:00:00'),
                total_hours: '8.00',
                date: '2024-01-15'
            }).execute();

            const startDate = new Date('2024-01-15');
            const endDate = new Date('2024-01-15');

            const summary = await getDepartmentSummary(startDate, endDate);

            expect(summary).toHaveLength(1);
            const salesSummary = summary[0];
            expect(salesSummary.department).toBe('Sales');
            expect(salesSummary.totalEmployees).toBe(2);
            expect(salesSummary.attendanceRate).toBe(50); // 1 out of 2 employees attended
        });
    });

    describe('getLeaveRequestsSummary', () => {
        it('should generate leave requests summary', async () => {
            // Create test user
            const user = await db.insert(usersTable).values({
                email: 'test@example.com',
                password_hash: 'hashedpassword123',
                first_name: 'Test',
                last_name: 'User',
                role: 'employee',
                department: 'IT',
                employee_id: 'TEST001',
                is_active: true
            }).returning().execute();

            // Create leave requests with different statuses and types
            await db.insert(leaveRequestsTable).values([
                {
                    user_id: user[0].id,
                    type: 'vacation',
                    start_date: '2024-01-15',
                    end_date: '2024-01-17',
                    reason: 'Family vacation',
                    status: 'approved'
                },
                {
                    user_id: user[0].id,
                    type: 'sick',
                    start_date: '2024-01-20',
                    end_date: '2024-01-21',
                    reason: 'Flu',
                    status: 'pending'
                },
                {
                    user_id: user[0].id,
                    type: 'personal',
                    start_date: '2024-01-25',
                    end_date: '2024-01-25',
                    reason: 'Personal matter',
                    status: 'rejected'
                },
                {
                    user_id: user[0].id,
                    type: 'vacation',
                    start_date: '2024-02-01',
                    end_date: '2024-02-03',
                    reason: 'Another vacation',
                    status: 'pending'
                }
            ]).execute();

            const summary = await getLeaveRequestsSummary();

            expect(summary.totalRequests).toBe(4);
            expect(summary.pendingRequests).toBe(2);
            expect(summary.approvedRequests).toBe(1);
            expect(summary.rejectedRequests).toBe(1);
            expect(summary.requestsByType['vacation']).toBe(2);
            expect(summary.requestsByType['sick']).toBe(1);
            expect(summary.requestsByType['personal']).toBe(1);
        });

        it('should filter by date range', async () => {
            // Create test user
            const user = await db.insert(usersTable).values({
                email: 'test@example.com',
                password_hash: 'hashedpassword123',
                first_name: 'Test',
                last_name: 'User',
                role: 'employee',
                department: 'IT',
                employee_id: 'TEST001',
                is_active: true
            }).returning().execute();

            // Create leave requests in different date ranges
            await db.insert(leaveRequestsTable).values([
                {
                    user_id: user[0].id,
                    type: 'vacation',
                    start_date: '2024-01-15',
                    end_date: '2024-01-17',
                    reason: 'Within range',
                    status: 'approved'
                },
                {
                    user_id: user[0].id,
                    type: 'sick',
                    start_date: '2024-02-15',
                    end_date: '2024-02-16',
                    reason: 'Outside range',
                    status: 'pending'
                }
            ]).execute();

            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');

            const summary = await getLeaveRequestsSummary(startDate, endDate);

            expect(summary.totalRequests).toBe(1);
            expect(summary.approvedRequests).toBe(1);
            expect(summary.pendingRequests).toBe(0);
            expect(summary.requestsByType['vacation']).toBe(1);
            expect(summary.requestsByType['sick']).toBeUndefined();
        });

        it('should return empty summary when no requests exist', async () => {
            const summary = await getLeaveRequestsSummary();

            expect(summary.totalRequests).toBe(0);
            expect(summary.pendingRequests).toBe(0);
            expect(summary.approvedRequests).toBe(0);
            expect(summary.rejectedRequests).toBe(0);
            expect(Object.keys(summary.requestsByType)).toHaveLength(0);
        });
    });
});
