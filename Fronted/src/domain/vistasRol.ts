export function esAdministrador(roles?: string | null): boolean {
  return (roles ?? '').toUpperCase().split(/[,;\s]+/).includes('ADMIN');
}
export function grupoPermitidoParaAdmin(id: string, admin: boolean): boolean {
  return !admin || !['compras', 'entregas'].includes(id);
}
export function rutaPersonalBloqueada(roles: string | null | undefined, pathname: string): boolean {
  return esAdministrador(roles) && ['/comprador', '/repartidor'].some(base => pathname === base || pathname.startsWith(`${base}/`));
}
