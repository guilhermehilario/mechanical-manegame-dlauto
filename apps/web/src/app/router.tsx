import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../modules/auth/use-auth';
import { LoginPage } from '../modules/auth/login-page';
import { AppLayout } from './layout/app-layout';
import { PlaceholderPage } from './placeholder-page';
import { CustomersPage } from '../modules/customers/customers-page';
import { CustomerDetailPage } from '../modules/customers/customer-detail-page';
import { VehiclesPage } from '../modules/vehicles/vehicles-page';
import { VehicleHistoryPage } from '../modules/vehicles/vehicle-history-page';
import { ServicesPage } from '../modules/services/services-page';
import { SuppliersPage } from '../modules/suppliers/suppliers-page';
import { ProductsPage } from '../modules/products/products-page';
import { AppointmentsPage } from '../modules/appointments/appointments-page';
import { WorkOrdersPage } from '../modules/work-orders/work-orders-page';
import { WorkOrderDetailPage } from '../modules/work-orders/work-order-detail-page';
import { VehiclePickupsPage } from '../modules/vehicle-pickups/vehicle-pickups-page';

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
        <Route path="vehicles/:vehicleId/history" element={<VehicleHistoryPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="work-orders" element={<WorkOrdersPage />} />
        <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
        <Route
          path="pickups"
          element={<VehiclePickupsPage />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
