
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { 
  User, 
  CreateUserInput, 
  AttendanceRecord, 
  LeaveRequest, 
  UpdateLeaveRequestStatusInput,
  LeaveRequestStatus,
  UserRole
} from '../../../server/src/schema';

interface AdminPanelProps {
  currentUser: User;
}

export function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // New user form state
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [newUser, setNewUser] = useState<CreateUserInput>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee' as UserRole,
    employee_id: null,
    department: null,
    hire_date: null
  });

  // Leave request approval state
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const userList: User[] = await trpc.getAllUsers.query();
      setUsers(userList);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, []);

  const loadAttendanceRecords = useCallback(async () => {
    try {
      const records: AttendanceRecord[] = await trpc.getAllAttendance.query();
      setAttendanceRecords(records);
    } catch (error) {
      console.error('Failed to load attendance records:', error);
    }
  }, []);

  const loadPendingLeaveRequests = useCallback(async () => {
    try {
      const requests: LeaveRequest[] = await trpc.getPendingLeaveRequests.query();
      setPendingLeaveRequests(requests);
    } catch (error) {
      console.error('Failed to load pending leave requests:', error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadAttendanceRecords();
    loadPendingLeaveRequests();
  }, [loadUsers, loadAttendanceRecords, loadPendingLeaveRequests]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    
    try {
      const user: User = await trpc.createUser.mutate(newUser);
      setUsers((prev: User[]) => [user, ...prev]);
      
      setNewUser({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'employee' as UserRole,
        employee_id: null,
        department: null,
        hire_date: null
      });
      
      setShowNewUserDialog(false);
      setMessage({ type: 'success', text: '✅ User created successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create user. Please try again.' });
      console.error('Failed to create user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLeaveRequestStatus = async (status: LeaveRequestStatus) => {
    if (!selectedRequest) return;
    
    setIsLoading(true);
    try {
      const input: UpdateLeaveRequestStatusInput = {
        id: selectedRequest.id,
        status,
        approved_by: currentUser.id,
        rejection_reason: status === 'rejected' ? rejectionReason : null
      };
      
      await trpc.updateLeaveRequestStatus.mutate(input);
      
      // Remove from pending requests
      setPendingLeaveRequests((prev: LeaveRequest[]) => 
        prev.filter((req: LeaveRequest) => req.id !== selectedRequest.id)
      );
      
      setSelectedRequest(null);
      setRejectionReason('');
      setMessage({ 
        type: 'success', 
        text: `✅ Leave request ${status === 'approved' ? 'approved' : 'rejected'} successfully!` 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update leave request status.' });
      console.error('Failed to update leave request status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
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

  const getUserName = (userId: number) => {
    const user = users.find((u: User) => u.id === userId);
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown User';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⚙️ Admin Dashboard
          </CardTitle>
          <CardDescription>
            Manage users, attendance, and leave requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="attendance">📊 Attendance</TabsTrigger>
          <TabsTrigger value="leave">🏖️ Leave Requests</TabsTrigger>
        </TabsList>

        {/* Users Management */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>👥 User Management</CardTitle>
                  <CardDescription>Add, edit, and manage employee accounts</CardDescription>
                </div>
                <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
                  <DialogTrigger asChild>
                    <Button>➕ Add User</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleCreateUser}>
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                          Add a new employee to the system
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              First Name
                            </label>
                            <Input
                              value={newUser.first_name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewUser((prev: CreateUserInput) => ({ ...prev, first_name: e.target.value }))
                              }
                              required
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Last Name
                            </label>
                            <Input
                              value={newUser.last_name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewUser((prev: CreateUserInput) => ({ ...prev, last_name: e.target.value }))
                              }
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Email
                          </label>
                          <Input
                            type="email"
                            value={newUser.email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setNewUser((prev: CreateUserInput) => ({ ...prev, email: e.target.value }))
                            }
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Password
                          </label>
                          <Input
                            type="password"
                            value={newUser.password}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setNewUser((prev: CreateUserInput) => ({ ...prev, password: e.target.value }))
                            }
                            required
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Role
                            </label>
                            <Select
                              value={newUser.role || 'employee'}
                              onValueChange={(value: UserRole) =>
                                setNewUser((prev: CreateUserInput) => ({ ...prev, role: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="employee">👤 Employee</SelectItem>
                                <SelectItem value="admin">👑 Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Employee ID
                            </label>
                            <Input
                              value={newUser.employee_id || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewUser((prev: CreateUserInput) => ({ 
                                  ...prev, 
                                  employee_id: e.target.value || null 
                                }))
                              }
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Department
                          </label>
                          <Input
                            value={newUser.department || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setNewUser((prev: CreateUserInput) => ({ 
                                ...prev, 
                                department: e.target.value || null 
                              }))
                            }
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowNewUserDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? '⏳ Creating...' : '✅ Create User'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>👤 Name</TableHead>
                      <TableHead>📧 Email</TableHead>
                      <TableHead>🏢 Department</TableHead>
                      <TableHead>🆔 Employee ID</TableHead>
                      <TableHead>👑 Role</TableHead>
                      <TableHead>📊 Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: User) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.department || '-'}</TableCell>
                        <TableCell>{user.employee_id || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? '👑 Admin' : '👤 Employee'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'destructive'}>
                            {user.is_active ? '✅ Active' : '❌ Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Records */}
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 All Attendance Records</CardTitle>
              <CardDescription>View attendance records for all employees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>👤 Employee</TableHead>
                      <TableHead>📅 Date</TableHead>
                      <TableHead>🚀 Clock In</TableHead>
                      <TableHead>🏠 Clock Out</TableHead>
                      <TableHead>⏰ Hours</TableHead>
                      <TableHead>📝 Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record: AttendanceRecord) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {getUserName(record.user_id)}
                        </TableCell>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>{formatTime(record.clock_in)}</TableCell>
                        <TableCell>{formatTime(record.clock_out)}</TableCell>
                        <TableCell>
                          {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Requests Management */}
        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🏖️ Pending Leave Requests</CardTitle>
              <CardDescription>Review and approve/reject employee leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>👤 Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>📅 Dates</TableHead>
                      <TableHead>📝 Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLeaveRequests.map((request: LeaveRequest) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {getUserName(request.user_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {request.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{formatDate(request.start_date)}</div>
                            <div className="text-gray-500">to {formatDate(request.end_date)}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm text-gray-600 line-clamp-2" title={request.reason}>
                            {request.reason}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                handleUpdateLeaveRequestStatus('approved');
                              }}
                              disabled={isLoading}
                            >
                              ✅ Approve
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setSelectedRequest(request)}
                                >
                                  ❌ Reject
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reject Leave Request</DialogTitle>
                                  <DialogDescription>
                                    Please provide a reason for rejecting this leave request.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <Textarea
                                    value={rejectionReason}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                                      setRejectionReason(e.target.value)
                                    }
                                    placeholder="Reason for rejection..."
                                    rows={3}
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRequest(null);
                                      setRejectionReason('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleUpdateLeaveRequestStatus('rejected')}
                                    disabled={isLoading || !rejectionReason.trim()}
                                  >
                                    {isLoading ? '⏳ Rejecting...' : '❌ Reject Request'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {pendingLeaveRequests.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-gray-500">
                      🎉 No pending leave requests at the moment!
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
