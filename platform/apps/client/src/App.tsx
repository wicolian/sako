import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IconSymbols } from './components/Icon';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShellGate } from './components/AppShellGate';
import { LoadingSpinner } from './components/LoadingSpinner';

// Layouts - keep eager as it's used for the main shell
import { ClientLayout } from './layouts/ClientLayout';

// Lazy-loaded Auth Pages
const SignInPage = React.lazy(() => import('./pages/auth/SignInPage').then(m => ({ default: m.SignInPage })));
const SignUpPage = React.lazy(() => import('./pages/auth/SignUpPage').then(m => ({ default: m.SignUpPage })));

// Lazy-loaded Client Pages
const DashboardPage = React.lazy(() => import('./pages/app/DashboardPage').then(m => ({ default: m.DashboardPage })));
const TasksListPage = React.lazy(() => import('./pages/app/TasksListPage').then(m => ({ default: m.TasksListPage })));
const TaskDetailPage = React.lazy(() => import('./pages/app/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const TaskCreatePage = React.lazy(() => import('./pages/app/TaskCreatePage').then(m => ({ default: m.TaskCreatePage })));
const CalendarPage = React.lazy(() => import('./pages/app/CalendarPage').then(m => ({ default: m.CalendarPage })));
const BrandsPage = React.lazy(() => import('./pages/app/BrandsPage').then(m => ({ default: m.BrandsPage })));
const SettingsPage = React.lazy(() => import('./pages/app/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Lazy-loaded Onboarding Pages
const PricingPage = React.lazy(() => import('./pages/onboarding/PricingPage').then(m => ({ default: m.PricingPage })));
const BillingSuccessPage = React.lazy(() => import('./pages/onboarding/BillingSuccessPage').then(m => ({ default: m.BillingSuccessPage })));

// Lazy-loaded Marketing Pages
const RedeemPage = React.lazy(() => import('./pages/RedeemPage').then(m => ({ default: m.RedeemPage })));

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
          {/* Clerk Auth */}
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />

          {/* Public routes */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/redeem" element={<RedeemPage />} />

          {/* Billing success requires auth */}
          <Route
            path="/billing/success"
            element={
              <ProtectedRoute>
                <BillingSuccessPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Client app */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShellGate>
                  <ClientLayout />
                </AppShellGate>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="tasks">
              <Route index element={<TasksListPage />} />
              <Route path="new" element={<TaskCreatePage />} />
              <Route path=":id" element={<TaskDetailPage />} />
            </Route>
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
