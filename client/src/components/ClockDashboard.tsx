
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { AttendanceRecord, ClockInInput, ClockOutInput } from '../../../server/src/schema';

interface ClockDashboardProps {
  userId: number;
}

export function ClockDashboard({ userId }: ClockDashboardProps) {
  const [attendanceStatus, setAttendanceStatus] = useState<{
    hasClockedIn: boolean;
    hasClockedOut: boolean;
    currentRecord: AttendanceRecord | null;
  }>({
    hasClockedIn: false,
    hasClockedOut: false,
    currentRecord: null
  });
  
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTodayStatus = useCallback(async () => {
    try {
      const status = await trpc.getTodayAttendanceStatus.query(userId);
      setAttendanceStatus(status);
    } catch (error) {
      console.error('Failed to load attendance status:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadTodayStatus();
  }, [loadTodayStatus]);

  const handleClockIn = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const clockInData: ClockInInput = {
        user_id: userId,
        notes: notes || null
      };
      
      const record: AttendanceRecord = await trpc.clockIn.mutate(clockInData);
      
      setAttendanceStatus({
        hasClockedIn: true,
        hasClockedOut: false,
        currentRecord: record
      });
      
      setNotes('');
      setMessage({ type: 'success', text: '🎉 Successfully clocked in! Have a great day!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clock in. Please try again.' });
      console.error('Clock in failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const clockOutData: ClockOutInput = {
        user_id: userId,
        notes: notes || null
      };
      
      const record: AttendanceRecord = await trpc.clockOut.mutate(clockOutData);
      
      setAttendanceStatus({
        hasClockedIn: true,
        hasClockedOut: true,
        currentRecord: record
      });
      
      setNotes('');
      setMessage({ type: 'success', text: '👋 Successfully clocked out! Thanks for your hard work today!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clock out. Please try again.' });
      console.error('Clock out failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateWorkingHours = () => {
    if (!attendanceStatus.currentRecord?.clock_in) return null;
    
    const clockIn = attendanceStatus.currentRecord.clock_in;
    const clockOut = attendanceStatus.currentRecord.clock_out || new Date();
    const diffMs = clockOut.getTime() - clockIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    
    return hours.toFixed(1);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⏰ Time Clock
          </CardTitle>
          <CardDescription>
            Record your daily attendance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-3">
            <div>
              <label htmlFor="notes" className="text-sm font-medium mb-2 block">
                Notes (optional)
              </label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Add any notes about your work day..."
                className="resize-none"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleClockIn}
                disabled={isLoading || attendanceStatus.hasClockedIn}
                className="flex-1"
                variant={attendanceStatus.hasClockedIn ? 'secondary' : 'default'}
              >
                {isLoading ? '⏳ Processing...' : 
                 attendanceStatus.hasClockedIn ? '✅ Clocked In' : '🚀 Clock In'}
              </Button>
              
              <Button
                onClick={handleClockOut}
                disabled={isLoading || !attendanceStatus.hasClockedIn || attendanceStatus.hasClockedOut}
                className="flex-1"
                variant={attendanceStatus.hasClockedOut ? 'secondary' : 'default'}
              >
                {isLoading ? '⏳ Processing...' : 
                 attendanceStatus.hasClockedOut ? '✅ Clocked Out' : '🏠 Clock Out'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Today's Status
          </CardTitle>
          <CardDescription>
            Your current attendance for today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {attendanceStatus.hasClockedIn ? '✅' : '⭕'}
                </div>
                <div className="text-sm font-medium">Clock In</div>
                {attendanceStatus.currentRecord?.clock_in && (
                  <div className="text-xs text-gray-500">
                    {formatTime(attendanceStatus.currentRecord.clock_in)}
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {attendanceStatus.hasClockedOut ? '✅' : '⭕'}
                </div>
                <div className="text-sm font-medium">Clock Out</div>
                {attendanceStatus.currentRecord?.clock_out && (
                  <div className="text-xs text-gray-500">
                    {formatTime(attendanceStatus.currentRecord.clock_out)}
                  </div>
                )}
              </div>
            </div>
            
            {attendanceStatus.hasClockedIn && (
              <>
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Working Hours:</span>
                    <Badge variant="outline">
                      {attendanceStatus.currentRecord?.total_hours?.toFixed(1) || calculateWorkingHours()} hours
                    </Badge>
                  </div>
                </div>
                
                {attendanceStatus.currentRecord?.notes && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium mb-1">Notes:</div>
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {attendanceStatus.currentRecord.notes}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!attendanceStatus.hasClockedIn && (
              <div className="text-center py-4">
                <div className="text-gray-500 text-sm">
                  👋 Ready to start your day?<br />
                  Clock in when you're ready!
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
