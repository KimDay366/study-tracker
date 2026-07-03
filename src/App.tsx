import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { ToastContainer } from '@/components/common/Toast';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  TodayStudy, LogicList, LogicEdit,
  Calendar, WeeklyReview, Routine, Settings, NotFound, Login, VerifyEmail,
} from '@/pages';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RootLayout() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <ToastContainer />
    </>
  );
}

const router = createBrowserRouter([
  // 공개 라우트
  { path: '/login', element: <Login /> },
  { path: '/verify-email', element: <VerifyEmail /> },

  // 보호 라우트 (AuthGuard → RootLayout → 화면)
  {
    element: <AuthGuard />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { path: '/', element: <TodayStudy /> },
          { path: '/logics', element: <LogicList /> },
          { path: '/logics/new', element: <LogicEdit /> },
          { path: '/logics/:id', element: <LogicEdit /> },
          { path: '/calendar', element: <Calendar /> },
          { path: '/weekly-review', element: <WeeklyReview /> },
          { path: '/routine', element: <Routine /> },
          { path: '/settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
