using FamKon_store_api.Models;

namespace FamKon_store_api.Data
{
    public interface IUsuarioRepository
    {
        Task<Usuario?> ObtenerPorCredenciales(string? correo, string? nombreUsuario, string contrasena);
        Task<Usuario?> ObtenerPorRostro(string imagenOriginalBase64);
        Task<Usuario?> ObtenerPorIdentificacionAsync(string identificacion);
        Task<Usuario?> ObtenerPorCarnet(string? codigoQr, string? identificacion);
    }
}