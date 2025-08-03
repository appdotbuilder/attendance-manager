
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { ClockDashboard } from './components/ClockDashboard';
import { AttendanceHistory } from './components/AttendanceHistory';
import { LeaveRequests } from './components/LeaveRequests';
import { AdminPanel } from './components/AdminPanel';
import type { User, LoginInput, LoginResponse } from '../../server/src/schema';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: ''
  });

  // Clear error when user starts typing
  const clearError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response: LoginResponse = await trpc.login.mutate(loginData);
      setUser(response.user);
      // Store token for future requests (in a real app, you'd handle this more securely)
      localStorage.setItem('auth-token', response.token);
      setLoginData({ email: '', password: '' });
    } catch (err) {
      setError('Invalid email or password. Please try again.');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await trpc.logout.mutate();
      setUser(null);
      localStorage.removeItem('auth-token');
    } catch (err) {
      console.error('Logout failed:', err);
      // Still log out locally even if server call fails
      setUser(null);
      localStorage.removeItem('auth-token');
    }
  };

  // Check for existing session on app load
  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      // In a real app, you'd validate the token with the server
      // For now, we'll just show the login form
    }
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              👥 Employee Portal
            </CardTitle>
            <CardDescription>
              Sign in to access your attendance dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={loginData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }));
                    clearError();
                  }}
                  placeholder="your.email@company.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }));
                    clearError();
                  }}
                  placeholder="Enter your password"
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '🔄 Signing in...' : '🚀 Sign In'}
              </Button>
            </form>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">Demo Credentials:</p>
              <div className="text-xs text-blue-700 space-y-1">
                <div>Employee: employee@company.com</div>
                <div>Admin: admin@company.com</div>
                <div>Password: password123</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                👥 Employee Portal
              </h1>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                {user.role === 'admin' ? '👑 Admin' : '👤 Employee'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-gray-500">
                  {user.department} • {user.employee_id}
                </p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                🚪 Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              ⏰ Dashboard
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              📊 My Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-2">
              🏖️ Leave Requests
            </TabsTrigger>
            {user.role === 'admin' && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                ⚙️ Admin Panel
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">📅 Today</CardTitle>
                  <CardDescription>
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </CardDescription>
                </CardHeader>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">👤 Employee Info</CardTitle>
                  <CardDescription>
                    {user.department && `${user.department} Department`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">ID:</span> {user.employee_id}</p>
                    {user.hire_date && (
                      <p><span className="font-medium">Hired:</span> {user.hire_date.toLocaleDateString()}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">📈 Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge variant={user.is_active ? 'default' : 'destructive'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />
            
            <ClockDashboard userId={user.id} />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceHistory userId={user.id} />
          </TabsContent>

          <TabsContent value="leave">
            <LeaveRequests userId={user.id} userRole={user.role} />
          </TabsContent>

          {user.role === 'admin' && (
            <TabsContent value="admin">
              <AdminPanel currentUser={user} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

export default App;
