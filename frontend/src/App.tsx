import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TicketListPage from './pages/TicketListPage'
import SelectTicketTypePage from './pages/SelectTicketTypePage'
import CreateTicketPage from './pages/CreateTicketPage'
import CreateDbTicketPage from './pages/CreateDbTicketPage'
import CreateDevTicketPage from './pages/CreateDevTicketPage'
import TicketDetailPage from './pages/TicketDetailPage'
import ResourceListPage from './pages/ResourceListPage'
import ProvidersPage from './pages/admin/ProvidersPage'
import ProviderFormPage from './pages/admin/ProviderFormPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="tickets" element={<TicketListPage />} />
            <Route path="tickets/type" element={<SelectTicketTypePage />} />
            <Route path="tickets/new/docker" element={<CreateTicketPage />} />
            <Route path="tickets/new/db" element={<CreateDbTicketPage />} />
            <Route path="tickets/new/dev" element={<CreateDevTicketPage />} />
            <Route path="tickets/:id" element={<TicketDetailPage />} />
            <Route path="resources" element={<ResourceListPage />} />
            <Route path="admin/providers" element={<ProvidersPage />} />
            <Route path="admin/providers/new" element={<ProviderFormPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
