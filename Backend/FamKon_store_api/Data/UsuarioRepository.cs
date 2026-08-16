using FamKon_store_api.Models;
using Microsoft.EntityFrameworkCore;

namespace FamKon_store_api.Data
{
    public class UsuarioRepository : IUsuarioRepository
    {
        private readonly AppDbContext _context;

        public UsuarioRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Usuario?> ObtenerPorCredenciales(string? correo, string? nombreUsuario, string contrasena)
        {
            if (string.IsNullOrWhiteSpace(correo) && string.IsNullOrWhiteSpace(nombreUsuario))
                return null;

            var query = _context.Usuarios.Where(u => u.Contrasena == contrasena);

            if (!string.IsNullOrWhiteSpace(correo))
                query = query.Where(u => u.Correo == correo);

            if (!string.IsNullOrWhiteSpace(nombreUsuario))
                query = query.Where(u => u.NombreUsuario == nombreUsuario);

            return await query.FirstOrDefaultAsync();
        }

        public async Task<Usuario?> ObtenerPorRostro(string imagenOriginalBase64)
        {
            return await _context.Usuarios.FirstOrDefaultAsync(u => u.ImagenOriginalBase64 == imagenOriginalBase64);
        }

        public async Task<Usuario?> ObtenerPorIdentificacionAsync(string identificacion)
        {
            return await _context.Usuarios.FirstOrDefaultAsync(u =>
                u.Correo == identificacion ||
                u.NombreUsuario == identificacion ||
                u.Id.ToString() == identificacion);
        }

        public async Task<Usuario?> ObtenerPorCarnet(string? codigoQr, string? identificacion)
        {
            return await _context.Usuarios.FirstOrDefaultAsync(u =>
                (codigoQr != null && u.CodigoQr == codigoQr) ||
                (identificacion != null && u.Id.ToString() == identificacion));
        }
    }
}