
import { db } from '../db';
import { usersTable, attendanceRecordsTable, leaveRequestsTable } from '../db/schema';
import { type GetAttendanceReportInput } from '../schema';
import { eq, and, gte, lte, isNotNull, SQL } from 'drizzle-orm';

export interface AttendanceReportData {
    userId: number;
    employeeName: string;
    department: string | null;
    totalDays: number;
    totalHours: number;
    averageHoursPerDay: number;
    lateArrivals: number;
    earlyDepartures: number;
}

export async function generateAttendanceReport(input: GetAttendanceReportInput): Promise<AttendanceReportData[]> {
    try {
        // Base query with join
        const baseQuery = db.select({
            userId: usersTable.id,
            employeeName: usersTable.first_name,
            lastName: usersTable.last_name,
            department: usersTable.department,
            clockIn: attendanceRecordsTable.clock_in,
            clockOut: attendanceRecordsTable.clock_out,
            totalHours: attendanceRecordsTable.total_hours,
            date: attendanceRecordsTable.date
        })
        .from(attendanceRecordsTable)
        .innerJoin(usersTable, eq(attendanceRecordsTable.user_id, usersTable.id));

        // Build conditions array
        const conditions: SQL<unknown>[] = [];

        if (input.start_date) {
            conditions.push(gte(attendanceRecordsTable.date, input.start_date.toISOString().split('T')[0]));
        }

        if (input.end_date) {
            conditions.push(lte(attendanceRecordsTable.date, input.end_date.toISOString().split('T')[0]));
        }

        if (input.department) {
            conditions.push(eq(usersTable.department, input.department));
        }

        if (input.user_id) {
            conditions.push(eq(usersTable.id, input.user_id));
        }

        // Apply where clause if conditions exist
        const query = conditions.length > 0 
            ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
            : baseQuery;

        const results = await query.execute();

        // Group by user and calculate statistics
        const userStats = new Map<number, {
            userId: number;
            employeeName: string;
            department: string | null;
            records: typeof results;
        }>();

        // Group records by user
        results.forEach(record => {
            if (!userStats.has(record.userId)) {
                userStats.set(record.userId, {
                    userId: record.userId,
                    employeeName: `${record.employeeName} ${record.lastName}`,
                    department: record.department,
                    records: []
                });
            }
            userStats.get(record.userId)!.records.push(record);
        });

        // Calculate statistics for each user
        const reportData: AttendanceReportData[] = [];

        for (const [userId, userData] of userStats) {
            const records = userData.records;
            const totalDays = records.length;
            
            // Calculate total hours
            let totalHours = 0;
            let lateArrivals = 0;
            let earlyDepartures = 0;

            records.forEach(record => {
                if (record.totalHours) {
                    totalHours += parseFloat(record.totalHours);
                }

                // Count late arrivals (after 9:00 AM)
                if (record.clockIn) {
                    const clockInTime = new Date(record.clockIn);
                    const clockInHour = clockInTime.getHours();
                    const clockInMinute = clockInTime.getMinutes();
                    if (clockInHour > 9 || (clockInHour === 9 && clockInMinute > 0)) {
                        lateArrivals++;
                    }
                }

                // Count early departures (before 5:00 PM)
                if (record.clockOut) {
                    const clockOutTime = new Date(record.clockOut);
                    const clockOutHour = clockOutTime.getHours();
                    if (clockOutHour < 17) {
                        earlyDepartures++;
                    }
                }
            });

            const averageHoursPerDay = totalDays > 0 ? totalHours / totalDays : 0;

            reportData.push({
                userId: userData.userId,
                employeeName: userData.employeeName,
                department: userData.department,
                totalDays,
                totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
                averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
                lateArrivals,
                earlyDepartures
            });
        }

        return reportData.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    } catch (error) {
        console.error('Attendance report generation failed:', error);
        throw error;
    }
}

export interface DepartmentSummary {
    department: string;
    totalEmployees: number;
    averageHoursPerDay: number;
    attendanceRate: number;
}

export async function getDepartmentSummary(startDate: Date, endDate: Date): Promise<DepartmentSummary[]> {
    try {
        // Get all users with their attendance records in the date range
        const baseQuery = db.select({
            department: usersTable.department,
            userId: usersTable.id,
            totalHours: attendanceRecordsTable.total_hours,
            date: attendanceRecordsTable.date
        })
        .from(usersTable)
        .leftJoin(attendanceRecordsTable, and(
            eq(usersTable.id, attendanceRecordsTable.user_id),
            gte(attendanceRecordsTable.date, startDate.toISOString().split('T')[0]),
            lte(attendanceRecordsTable.date, endDate.toISOString().split('T')[0])
        ));

        const query = baseQuery.where(and(
            eq(usersTable.is_active, true),
            isNotNull(usersTable.department)
        ));

        const results = await query.execute();

        // Group by department
        const departmentStats = new Map<string, {
            employees: Set<number>;
            totalHours: number;
            totalWorkingDays: number;
        }>();

        results.forEach(record => {
            const dept = record.department!;
            
            if (!departmentStats.has(dept)) {
                departmentStats.set(dept, {
                    employees: new Set(),
                    totalHours: 0,
                    totalWorkingDays: 0
                });
            }

            const stats = departmentStats.get(dept)!;
            stats.employees.add(record.userId);

            if (record.totalHours && record.date) {
                stats.totalHours += parseFloat(record.totalHours);
                stats.totalWorkingDays++;
            }
        });

        // Calculate working days in the date range (excluding weekends)
        const totalWorkingDays = calculateWorkingDays(startDate, endDate);

        // Build summary
        const summaries: DepartmentSummary[] = [];

        for (const [department, stats] of departmentStats) {
            const totalEmployees = stats.employees.size;
            const averageHoursPerDay = stats.totalWorkingDays > 0 ? stats.totalHours / stats.totalWorkingDays : 0;
            const expectedWorkingDays = totalEmployees * totalWorkingDays;
            const actualWorkingDays = stats.totalWorkingDays;
            const attendanceRate = expectedWorkingDays > 0 ? (actualWorkingDays / expectedWorkingDays) * 100 : 0;

            summaries.push({
                department,
                totalEmployees,
                averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
                attendanceRate: Math.round(attendanceRate * 100) / 100
            });
        }

        return summaries.sort((a, b) => a.department.localeCompare(b.department));
    } catch (error) {
        console.error('Department summary generation failed:', error);
        throw error;
    }
}

export interface LeaveRequestsSummary {
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    requestsByType: Record<string, number>;
}

export async function getLeaveRequestsSummary(startDate?: Date, endDate?: Date): Promise<LeaveRequestsSummary> {
    try {
        // Build query with optional date filters
        const baseQuery = db.select({
            status: leaveRequestsTable.status,
            type: leaveRequestsTable.type
        }).from(leaveRequestsTable);

        const conditions: SQL<unknown>[] = [];

        if (startDate) {
            conditions.push(gte(leaveRequestsTable.start_date, startDate.toISOString().split('T')[0]));
        }

        if (endDate) {
            conditions.push(lte(leaveRequestsTable.end_date, endDate.toISOString().split('T')[0]));
        }

        const query = conditions.length > 0 
            ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
            : baseQuery;

        const results = await query.execute();

        // Initialize counters
        let totalRequests = 0;
        let pendingRequests = 0;
        let approvedRequests = 0;
        let rejectedRequests = 0;
        const requestsByType: Record<string, number> = {};

        // Count requests by status and type
        results.forEach(record => {
            totalRequests++;

            switch (record.status) {
                case 'pending':
                    pendingRequests++;
                    break;
                case 'approved':
                    approvedRequests++;
                    break;
                case 'rejected':
                    rejectedRequests++;
                    break;
            }

            // Count by type
            requestsByType[record.type] = (requestsByType[record.type] || 0) + 1;
        });

        return {
            totalRequests,
            pendingRequests,
            approvedRequests,
            rejectedRequests,
            requestsByType
        };
    } catch (error) {
        console.error('Leave requests summary generation failed:', error);
        throw error;
    }
}

// Helper function to calculate working days (excluding weekends)
function calculateWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
}
