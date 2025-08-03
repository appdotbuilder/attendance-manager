
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import type { LeaveRequest, CreateLeaveRequestInput, LeaveRequestType, LeaveRequestStatus, UserRole } from '../../../server/src/schema';

interface LeaveRequestsProps {
  userId: number;
  userRole: UserRole;
}

export function LeaveRequests({ userId }: LeaveRequestsProps) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  
  const [newRequest, setNewRequest] = useState<CreateLeaveRequestInput>({
    user_id: userId,
    type: 'vacation' as LeaveRequestType,
    start_date: new Date(),
    end_date: new Date(),
    reason: ''
  });

  const loadLeaveRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const requests: LeaveRequest[] = await trpc.getUserLeaveRequests.query(userId);
      setLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLeaveRequests();
  }, [loadLeaveRequests]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const request: LeaveRequest = await trpc.createLeaveRequest.mutate(newRequest);
      setLeaveRequests((prev: LeaveRequest[]) => [request, ...prev]);
      
      setNewRequest({
        user_id: userId,
        type: 'vacation' as LeaveRequestType,
        start_date: new Date(),
        end_date: new Date(),
        reason: ''
      });
      
      setShowNewRequestDialog(false);
      setMessage({ type: 'success', text: '🎉 Leave request submitted successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit leave request. Please try again.' });
      console.error('Failed to submit leave request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    try {
      await trpc.deleteLeaveRequest.mutate({ requestId, userId });
      setLeaveRequests((prev: LeaveRequest[]) => prev.filter((req: LeaveRequest) => req.id !== requestId));
      setMessage({ type: 'success', text: 'Leave request deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete leave request.' });
      console.error('Failed to delete leave request:', error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: LeaveRequestStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">⏳ Pending</Badge>;
      case 'approved':
        return <Badge variant="default">✅ Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">❌ Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeEmoji = (type: LeaveRequestType) => {
    switch (type) {
      case 'vacation': return '🏖️';
      case 'sick': return '🤒';
      case 'personal': return '👤';
      case 'emergency': return '🚨';
      default: return '📋';
    }
  };

  const calculateDays = (startDate: Date, endDate: Date) => {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header and New Request Button */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                🏖️ Leave Requests
              </CardTitle>
              <CardDescription>
                Submit and manage your leave requests
              </CardDescription>
            </div>
            <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
              <DialogTrigger asChild>
                <Button>➕ New Request</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmitRequest}>
                  <DialogHeader>
                    <DialogTitle>Submit Leave Request</DialogTitle>
                    <DialogDescription>
                      Fill out the details for your leave request
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Leave Type
                      </label>
                      <Select
                        value={newRequest.type || 'vacation'}
                        onValueChange={(value: LeaveRequestType) =>
                          setNewRequest((prev: CreateLeaveRequestInput) => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation">🏖️ Vacation</SelectItem>
                          <SelectItem value="sick">🤒 Sick Leave</SelectItem>
                          <SelectItem value="personal">👤 Personal</SelectItem>
                          <SelectItem value="emergency">🚨 Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Start Date
                        </label>
                        <Input
                          type="date"
                          value={newRequest.start_date.toISOString().split('T')[0]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewRequest((prev: CreateLeaveRequestInput) => ({
                              ...prev,
                              start_date: new Date(e.target.value)
                            }))
                          }
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={newRequest.end_date.toISOString().split('T')[0]}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setNewRequest((prev: CreateLeaveRequestInput) => ({
                              ...prev,
                              end_date: new Date(e.target.value)
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Reason
                      </label>
                      <Textarea
                        value={newRequest.reason}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setNewRequest((prev: CreateLeaveRequestInput) => ({
                            ...prev,
                            reason: e.target.value
                          }))
                        }
                        placeholder="Please provide a reason for your leave request..."
                        rows={3}
                        required
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewRequestDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? '⏳ Submitting...' : '📤 Submit Request'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">🔄 Loading leave requests...</div>
            </div>
          
          ) : leaveRequests.length === 0 ? (
            <Alert>
              <AlertDescription>
                📝 No leave requests found. Click "New Request" to submit your first leave request.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>📅 Dates</TableHead>
                    <TableHead>⏰ Days</TableHead>
                    <TableHead>📊 Status</TableHead>
                    <TableHead>📝 Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.map((request: LeaveRequest) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getTypeEmoji(request.type)}</span>
                          <span className="capitalize">{request.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(request.start_date)}</div>
                          <div className="text-gray-500">to {formatDate(request.end_date)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {calculateDays(request.start_date, request.end_date)} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm text-gray-600 line-clamp-2" title={request.reason}>
                          {request.reason}
                        </div>
                        {request.rejection_reason && (
                          <div className="text-xs text-red-600 mt-1">
                            Reason: {request.rejection_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {request.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRequest(request.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            🗑️ Delete
                          </Button>
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
