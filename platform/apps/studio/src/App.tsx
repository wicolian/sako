import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';
import { IconSymbols } from './components/Icon';
import { LoadingSpinner } from './components/LoadingSpinner';

import { StudioLayout } from './layouts/StudioLayout';
import { StudioProtectedRoute } from './components/auth/StudioProtectedRoute';

// Lazy-loaded Studio Pages
const StudioDashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.StudioDashboardPage })));
const ClientsListPage = React.lazy(() => import('./pages/ClientsListPage').then(m => ({ default: m.ClientsListPage })));
const ClientDetailPage = React.lazy(() => import('./pages/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const StudioTasksListPage = React.lazy(() => import('./pages/TasksListPage').then(m => ({ default: m.StudioTasksListPage })));
const StudioTaskDetailPage = React.lazy(() => import('./pages/TaskDetailPage').then(m => ({ default: m.StudioTaskDetailPage })));
const StudioCalendarPage = React.lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.StudioCalendarPage })));
const StudioSettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.StudioSettingsPage })));
const StudioPodsPage = React.lazy(() => import('./pages/PodsPage').then(m => ({ default: m.StudioPodsPage })));
const StudioBillingPage = React.lazy(() => import('./pages/BillingPage').then(m => ({ default: m.StudioBillingPage })));
const StudioAiInsightsPage = React.lazy(() => import('./pages/app/StudioAiInsightsPage').then(m => ({ default: m.StudioAiInsightsPage })));
const PendingAdminsPage = React.lazy(() => import('./pages/PendingAdminsPage').then(m => ({ default: m.PendingAdminsPage })));
const AdminClientsPage = React.lazy(() => import('./pages/admin/AdminClientsPage').then(m => ({ default: m.AdminClientsPage })));
const AdminUsersPage = React.lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));

export default function App() {
  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (theme === 'dark' || (!theme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <IconSymbols />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Clerk sign-in */}
          <Route path="/sign-in" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <SignIn routing="path" path="/sign-in" />
            </div>
          } />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/studio/dashboard" replace />} />

          {/* Studio routes */}
          <Route
            path="/studio"
            element={
              <StudioProtectedRoute>
                <StudioLayout />
              </StudioProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudioDashboardPage />} />
            <Route path="clients" element={<ClientsListPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="tasks" element={<StudioTasksListPage />} />
            <Route path="tasks/:id" element={<StudioTaskDetailPage />} />
            {/* Keep a single unified Tasks/Kanban view; /studio/kanban just redirects */}
            <Route path="kanban" element={<Navigate to="tasks" replace />} />
            <Route path="calendar" element={<StudioCalendarPage />} />
            <Route path="settings" element={<StudioSettingsPage />} />
            <Route path="pods" element={<StudioPodsPage />} />
            <Route path="billing" element={<StudioBillingPage />} />
            <Route path="ai" element={<StudioAiInsightsPage />} />
            <Route path="admin/pending-admins" element={<PendingAdminsPage />} />
            <Route path="admin/clients" element={<AdminClientsPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/studio/dashboard" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
