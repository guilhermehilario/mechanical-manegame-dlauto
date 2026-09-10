import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/use-auth';
import { LoginPage } from '../modules/auth/login-page';
import { AppLayout } from './layout/app-layout';
import { PlaceholderPage } from './placeholder-page';
import { CustomersPage } from '../modules/customers/customers-page';
import { CustomerDetailPage } from '../modules/customers/customer-detail-page';
import { VehiclesPage } from '../modules/vehicles/vehicles-page';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function AppRouter() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PlaceholderPage title="Dashboard" phase="Fase 8" />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="services" element={<PlaceholderPage title="Serviços" phase="Fase 3" />} />
        <Route path="products" element={<PlaceholderPage title="Produtos" phase="Fase 3" />} />
        <Route path="suppliers" element={<PlaceholderPage title="Fornecedores" phase="Fase 3" />} />
        <Route
          path="appointments"
          element={<PlaceholderPage title="Agendamentos" phase="Fase 4" />}
        />
        <Route
          path="work-orders"
          element={<PlaceholderPage title="Ordens de Serviço" phase="Fase 5" />}
        />
        <Route
          path="pickups"
          element={<PlaceholderPage title="Retirada/Entrega" phase="Fase 7" />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
