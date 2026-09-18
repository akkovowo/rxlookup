import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "@/lib/store";
import { KeyPage, LoginPage, RegisterPage } from "@/pages/Auth";
import { PanelPage } from "@/pages/PanelPage";
import { SsndobHistoryPage, SsndobPage } from "@/pages/SsndobPage";
import { CsPage } from "@/pages/CsPage";
import { ApiDocsPage } from "@/pages/ApiDocsPage";
import { ApiCabinetPage } from "@/pages/ApiCabinetPage";
import { DocsLayout } from "@/components/DocsLayout";
import { FaqPage } from "@/pages/FaqPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { HistoryPage } from "@/pages/HistoryPage";
import { HelpPage } from "@/pages/TicketsPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TopupPage } from "@/pages/TopupPage";
import { AppLayout } from "@/components/AppLayout";
import { AdminPage } from "@/pages/AdminPage";
import type { ReactNode } from "react";

function Guard({ children }: { children: ReactNode }) {
  const { user, hydrating } = useApp();
  if (hydrating) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Guest({ children }: { children: ReactNode }) {
  const { user, hydrating } = useApp();
  if (hydrating) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, hydrating } = useApp();
  if (hydrating) return null;
  if (!user || user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function isDocsHost() {
  return typeof window !== "undefined" && window.location.hostname.startsWith("docs.");
}

export default function App() {
  if (isDocsHost()) {
    return (
      <Routes>
        <Route
          path="*"
          element={
            <DocsLayout>
              <ApiDocsPage />
            </DocsLayout>
          }
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Guest>
            <LoginPage />
          </Guest>
        }
      />
      <Route
        path="/register"
        element={
          <Guest>
            <RegisterPage />
          </Guest>
        }
      />
      <Route
        path="/key"
        element={
          <Guest>
            <KeyPage />
          </Guest>
        }
      />
      <Route path="/reset-password" element={<Navigate to="/key" replace />} />
      <Route
        element={
          <Guard>
            <AppLayout />
          </Guard>
        }
      >
        <Route path="/" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/topup" element={<TopupPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/search" element={<PanelPage />} />
        <Route path="/panel" element={<Navigate to="/search" replace />} />
        <Route path="/ssndob" element={<SsndobPage />} />
        <Route path="/ssndob/history" element={<SsndobHistoryPage />} />
        <Route path="/cs" element={<CsPage />} />
        <Route path="/api" element={<ApiCabinetPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/tickets" element={<Navigate to="/help" replace />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminPage />
            </AdminGuard>
          }
        />
        <Route
          path="/admin/:tab"
          element={
            <AdminGuard>
              <AdminPage />
            </AdminGuard>
          }
        />
      </Route>
      <Route
        path="/docs"
        element={
          <DocsLayout>
            <ApiDocsPage />
          </DocsLayout>
        }
      />
      <Route path="/api-docs" element={<Navigate to="/docs" replace />} />
      <Route path="/profile" element={<Navigate to="/" replace />} />
      <Route path="/catalog" element={<Navigate to="/" replace />} />
      <Route path="/messages" element={<Navigate to="/" replace />} />
      <Route path="/messages/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
