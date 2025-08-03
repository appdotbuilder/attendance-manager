
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createUserInputSchema, 
  updateUserInputSchema,
  clockInInputSchema,
  clockOutInputSchema,
  getUserAttendanceInputSchema,
  createLeaveRequestInputSchema,
  updateLeaveRequestStatusInputSchema,
  getAttendanceReportInputSchema,
  loginInputSchema
} from './schema';

// Import handlers
import { login, logout } from './handlers/auth';
import { 
  createUser, 
  updateUser, 
  deleteUser, 
  getAllUsers, 
  getUserById 
} from './handlers/user_management';
import { 
  clockIn, 
  clockOut, 
  getUserAttendance, 
  getAllAttendance,
  getTodayAttendanceStatus 
} from './handlers/attendance';
import { 
  createLeaveRequest, 
  updateLeaveRequestStatus, 
  getUserLeaveRequests, 
  getAllLeaveRequests,
  getPendingLeaveRequests,
  deleteLeaveRequest 
} from './handlers/leave_requests';
import { 
  generateAttendanceReport, 
  getDepartmentSummary, 
  getLeaveRequestsSummary 
} from './handlers/reports';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),
  
  logout: publicProcedure
    .mutation(() => logout()),

  // User management routes (Admin)
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),
  
  deleteUser: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteUser(input)),
  
  getAllUsers: publicProcedure
    .query(() => getAllUsers()),
  
  getUserById: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserById(input)),

  // Attendance routes
  clockIn: publicProcedure
    .input(clockInInputSchema)
    .mutation(({ input }) => clockIn(input)),
  
  clockOut: publicProcedure
    .input(clockOutInputSchema)
    .mutation(({ input }) => clockOut(input)),
  
  getUserAttendance: publicProcedure
    .input(getUserAttendanceInputSchema)
    .query(({ input }) => getUserAttendance(input)),
  
  getAllAttendance: publicProcedure
    .query(() => getAllAttendance()),
  
  getTodayAttendanceStatus: publicProcedure
    .input(z.number())
    .query(({ input }) => getTodayAttendanceStatus(input)),

  // Leave request routes
  createLeaveRequest: publicProcedure
    .input(createLeaveRequestInputSchema)
    .mutation(({ input }) => createLeaveRequest(input)),
  
  updateLeaveRequestStatus: publicProcedure
    .input(updateLeaveRequestStatusInputSchema)
    .mutation(({ input }) => updateLeaveRequestStatus(input)),
  
  getUserLeaveRequests: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserLeaveRequests(input)),
  
  getAllLeaveRequests: publicProcedure
    .query(() => getAllLeaveRequests()),
  
  getPendingLeaveRequests: publicProcedure
    .query(() => getPendingLeaveRequests()),
  
  deleteLeaveRequest: publicProcedure
    .input(z.object({ requestId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteLeaveRequest(input.requestId, input.userId)),

  // Report routes (Admin)
  generateAttendanceReport: publicProcedure
    .input(getAttendanceReportInputSchema)
    .query(({ input }) => generateAttendanceReport(input)),
  
  getDepartmentSummary: publicProcedure
    .input(z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }))
    .query(({ input }) => getDepartmentSummary(input.startDate, input.endDate)),
  
  getLeaveRequestsSummary: publicProcedure
    .input(z.object({ 
      startDate: z.coerce.date().optional(), 
      endDate: z.coerce.date().optional() 
    }))
    .query(({ input }) => getLeaveRequestsSummary(input.startDate, input.endDate)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Employee Attendance Management TRPC server listening at port: ${port}`);
}

start();
