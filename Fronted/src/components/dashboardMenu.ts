import {
  Store,
  ShoppingCart,
  Truck,
  History,
  ClipboardList,
  BarChart3,
  Users,
  Boxes,
  ShieldCheck,
  Database,
  Settings,
  UserCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Tag,
  MapPin,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface MenuItem {
  codigo?: string;
  path: string;
  label: string;
  icon: IconComponent;
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: IconComponent;
  // Si la cadena esta vacia el grupo es visible para cualquier usuario autenticado.
  // Si tiene un valor, el grupo se muestra solo si el usuario tiene ESE rol.
  codigoRol?: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: "compras",
    label: "Compras",
    icon: Tag,
    codigoRol: "COMPRADOR",
    items: [
      { codigo: "VER_CATALOGO",  path: "/comprador/catalogo", label: "Catalogo",  icon: Store },
      { codigo: "VER_CARRITO",   path: "/comprador/carrito",  label: "Mi Carrito", icon: ShoppingCart },
      { codigo: "VER_TRACKING",  path: "/comprador/tracking", label: "Mis pedidos", icon: Truck },
      { codigo: "VER_HISTORICO", path: "/comprador/historico", label: "Historico", icon: History },
    ],
  },
  {
    id: "entregas",
    label: "Entregas",
    icon: Truck,
    codigoRol: "REPARTIDOR",
    items: [
      { codigo: "VER_PEDIDOS_ASIGNADOS",   path: "/repartidor/asignados",       label: "Mis Pedidos",      icon: ClipboardList },
    ],
  },
  {
    id: "tracking",
    label: "Tracking",
    icon: MapPin,
    codigoRol: "SUPERVISOR",
    items: [
      { codigo: "GESTIONAR_ENTREGAS", path: "/entregas/tracking", label: "Tracking General", icon: Truck },
    ],
  },
  {
    id: "supervision",
    label: "Supervision",
    icon: ShieldCheck,
    codigoRol: "SUPERVISOR",
    items: [
      { codigo: "VER_DASHBOARD",         path: "/supervisor",         label: "Dashboard",         icon: BarChart3 },
      { codigo: "GESTIONAR_USUARIOS",    path: "/admin/usuarios",     label: "Gestor Usuarios",   icon: Users },
      { codigo: "GESTIONAR_PRODUCTOS",   path: "/admin/productos",    label: "Gestor Productos",  icon: Boxes },
    ],
  },
  {
    id: "administracion",
    label: "Administracion",
    icon: Settings,
    codigoRol: "ADMIN",
    items: [
      { codigo: "VER_DASHBOARD", path: "/admin/pedidos", label: "Gestión de pedidos", icon: ClipboardList },
      { codigo: "VER_DASHBOARD",         path: "/admin",              label: "Dashboard Admin",    icon: BarChart3 },
      { codigo: "GESTIONAR_USUARIOS",    path: "/admin/usuarios",     label: "Gestor Usuarios",    icon: Users },
      { codigo: "GESTIONAR_CATALOGOS",   path: "/admin/catalogos",    label: "Catalogos",          icon: Boxes },
      { codigo: "GESTIONAR_ROLES",       path: "/admin/roles",        label: "Roles y Permisos",   icon: ShieldCheck },
      { codigo: "GESTIONAR_USUARIOS",    path: "/admin/bitacora",     label: "Bitacora",           icon: Database },
    ],
  },
  {
    id: "cuenta",
    label: "Cuenta",
    icon: UserCircle,
    items: [
      { path: "/perfil", label: "Mi Perfil", icon: UserCircle },
    ],
  },
];

export const LOGOUT_ITEM: MenuItem = {
  path: "__logout__",
  label: "Cerrar sesion",
  icon: LogOut,
};

export { ChevronDown, ChevronRight };
