import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import IndexPage from "./pages/IndexPage";
import LoginPage from "./pages/LoginPage";
import FacialLoginPage from "./pages/FacialLoginPage";
import CarnetLoginPage from "./pages/CarnetLoginPage";
import DashboardPage from "./pages/DashboardPage";
import CatalogoPage from "./pages/CatalogoPage";
import ProductoDetallePage from "./pages/ProductoDetallePage";
import CarritoPage from "./pages/CarritoPage";
import TrackingPage from "./pages/TrackingPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useAuth } from "./context/AuthContext";
import RegistroPage from "./pages/RegistroPage";
import PerfilPage from "./pages/PerfilPage";
import SupervisorPage from "./pages/SupervisorPage";
import RepartidorPage from "./pages/RepartidorPage";
import RepartidorAsignadosSection from "./pages/RepartidorAsignadosSection";
import RepartidorRegistrarSection from "./pages/RepartidorRegistrarSection";
import RepartidorCambiarEstadoSection from "./pages/RepartidorCambiarEstadoSection";
import EntregasAdminPage from "./pages/EntregasAdminPage";
import AdminPage from "./pages/AdminPage";
import UsuariosAdminPage from "./pages/UsuariosAdminPage";
import AdminProductosPage from "./pages/AdminProductosPage";
import AdminCatalogosPage from "./pages/AdminCatalogosPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminBitacoraPage from "./pages/AdminBitacoraPage";
import AdminConfiguracionPage from "./pages/AdminConfiguracionPage";
import RequirePermiso from "./components/RequirePermiso";
import DashboardLayout from "./components/DashboardLayout";

function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Rutas publicas (sin dashboard) */}
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/login/facial" element={<FacialLoginPage />} />
      <Route path="/login/carnet" element={<CarnetLoginPage />} />

      {/* Dashboard protegido con sidebar + topbar */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/inicio" element={<DashboardPage />} />
        <Route path="/perfil" element={<PerfilPage />} />

        {/* Rutas del comprador */}
        <Route
          path="/comprador/catalogo"
          element={
            <RequirePermiso codigoPermiso="VER_CATALOGO">
              <CatalogoPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/comprador/producto/:id"
          element={
            <RequirePermiso codigoPermiso="VER_CATALOGO">
              <ProductoDetallePage />
            </RequirePermiso>
          }
        />
        <Route
          path="/comprador/carrito"
          element={
            <RequirePermiso codigoPermiso="VER_CARRITO">
              <CarritoPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/comprador/tracking"
          element={
            <RequirePermiso codigoPermiso="VER_TRACKING">
              <TrackingPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/comprador/historico"
          element={
            <RequirePermiso codigoPermiso="VER_HISTORICO">
              <TrackingPage />
            </RequirePermiso>
          }
        />

        {/* Rutas del repartidor (tambien visibles para ADMIN/SUPERVISOR que gestionan entregas) */}
        <Route
          path="/repartidor"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_ENTREGAS">
              <RepartidorPage />
            </RequirePermiso>
          }
        >
          <Route index element={<Navigate to="/repartidor/asignados" replace />} />
          <Route path="asignados" element={<RepartidorAsignadosSection />} />
          <Route path="registrar" element={<RepartidorRegistrarSection />} />
          <Route path="cambiar-estado" element={<RepartidorCambiarEstadoSection />} />
        </Route>
        <Route
          path="/entregas/tracking"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_ENTREGAS">
              <EntregasAdminPage />
            </RequirePermiso>
          }
        />

        {/* Rutas del supervisor */}
        <Route
          path="/supervisor"
          element={
            <RequirePermiso codigoRol="SUPERVISOR">
              <SupervisorPage />
            </RequirePermiso>
          }
        />

        {/* Rutas del administrador */}
        <Route
          path="/admin"
          element={
            <RequirePermiso codigoRol="ADMIN">
              <AdminPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_USUARIOS">
              <UsuariosAdminPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/productos"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_PRODUCTOS">
              <AdminProductosPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/catalogos"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_CATALOGOS">
              <AdminCatalogosPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_ROLES">
              <AdminRolesPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/bitacora"
          element={
            <RequirePermiso codigoPermiso="GESTIONAR_USUARIOS">
              <AdminBitacoraPage />
            </RequirePermiso>
          }
        />
        <Route
          path="/admin/configuracion"
          element={
            <RequirePermiso codigoRol="ADMIN">
              <AdminConfiguracionPage />
            </RequirePermiso>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
