
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { AttendanceRecord, GetUserAttendanceInput } from '../../../server/src/schema';

interface AttendanceHistoryProps {
  userId: number;
}

export function AttendanceHistory({ userId }: AttendanceHistoryProps) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });

  const loadAttendanceHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const input: GetUserAttendanceInput = {
        user_id: userId,
        ...(dateFilter.startDate && { start_date: new Date(dateFilter.startDate) }),
        ...(dateFilter.endDate && { end_date: new Date(dateFilter.endDate) })
      };
      
      const records: AttendanceRecord[] = await trpc.getUserAttendance.query(input);
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Failed to load attendance history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, dateFilter]);

  useEffect(() => {
    loadAttendanceHistory();
  }, [loadAttendanceHistory]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '-';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.clock_out) {
      return <Badge variant="default">✅ Complete</Badge>;
    } else {
      return <Badge variant="secondary">⏳ In Progress</Badge>;
    }
  };

  const handleFilterChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateFilter((prev: typeof dateFilter) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setDateFilter({ startDate: '', endDate: '' });
  };

  const calculateTotalHours = () => {
    return attendanceRecords
      .filter((record: AttendanceRecord) => record.total_hours)
      .reduce((total: number, record: AttendanceRecord) => total + (record.total_hours || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Attendance History
          </CardTitle>
          <CardDescription>
            View and filter your attendance records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div>
                <label htmlFor="startDate" className="text-sm font-medium mb-1 block">
                  From Date
                </label>
                <Input
                  id="startDate"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleFilterChange('startDate', e.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="endDate" className="text-sm font-medium mb-1 block">
                  To Date
                </label>
                <Input
                  id="endDate"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    handleFilterChange('endDate', e.target.value)
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={loadAttendanceHistory} 
                disabled={isLoading}
                variant="default"
              >
                {isLoading ? '🔄 Loading...' : '🔍 Filter'}
              </Button>
              <Button 
                onClick={clearFilters} 
                variant="outline"
              >
                🗑️ Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {attendanceRecords.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {attendanceRecords.length}
                </div>
                <div className="text-sm text-gray-600">
                  📅 Total Days
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {calculateTotalHours().toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">
                  ⏰ Total Hours
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {attendanceRecords.length > 0 ? (calculateTotalHours() / attendanceRecords.filter((r: AttendanceRecord) => r.total_hours).length || 0).toFixed(1) : '0.0'}
                </div>
                <div className="text-sm text-gray-600">
                  📊 Avg Hours/Day
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">🔄 Loading attendance records...</div>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <Alert>
              <AlertDescription>
                📝 No attendance records found for the selected period. 
                {dateFilter.startDate || dateFilter.endDate ? ' Try adjusting your date filters.' : ''}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>📅 Date</TableHead>
                    <TableHead>🚀 Clock In</TableHead>
                    <TableHead>🏠 Clock Out</TableHead>
                    <TableHead>⏰ Hours</TableHead>
                    <TableHead>📊 Status</TableHead>
                    <TableHead>📝 Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record: AttendanceRecord) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {formatDate(record.date)}
                      </TableCell>
                      <TableCell>
                        {formatTime(record.clock_in)}
                      </TableCell>
                      <TableCell>
                        {formatTime(record.clock_out)}
                      </TableCell>
                      <TableCell>
                        {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {record.notes ? (
                          <div className="text-sm text-gray-600 truncate" title={record.notes}>
                            {record.notes}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
