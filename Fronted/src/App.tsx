import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import IndexPage from "./pages/IndexPage";
import LoginPage from "./pages/LoginPage";
import FacialLoginPage from "./pages/FacialLoginPage";
import CarnetLoginPage from "./pages/CarnetLoginPage";
import HomePage from "./pages/HomePage";
import CatalogoPage from "./pages/CatalogoPage";
import ProductoDetallePage from "./pages/ProductoDetallePage";
import CarritoPage from "./pages/CarritoPage";
import TrackingPage from "./pages/TrackingPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useAuth } from "./context/AuthContext";
import RegistroPage from "./pages/RegistroPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<IndexPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/login/facial" element={<FacialLoginPage />} />
      <Route path="/login/carnet" element={<CarnetLoginPage />} />

      <Route
        path="/inicio"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />

      {/* Rutas del comprador */}
      <Route
        path="/comprador/catalogo"
        element={
          <RequireAuth>
            <CatalogoPage />
          </RequireAuth>
        }
      />
      <Route
        path="/comprador/producto/:id"
        element={
          <RequireAuth>
            <ProductoDetallePage />
          </RequireAuth>
        }
      />
      <Route
        path="/comprador/carrito"
        element={
          <RequireAuth>
            <CarritoPage />
          </RequireAuth>
        }
      />
      <Route
        path="/comprador/tracking"
        element={
          <RequireAuth>
            <TrackingPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
