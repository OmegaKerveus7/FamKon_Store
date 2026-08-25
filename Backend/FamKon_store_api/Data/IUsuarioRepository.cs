using FamKon_store_api.Models;

namespace FamKon_store_api.Data
{
    public interface IUsuarioRepository
    {
        Task<LoginResult> LoginPorCredencialesAsync(string? correo, string? nickname, string contrasena);
        Task<LoginResult> LoginPorQrAsync(string codigoQr);
        Task<Usuario?> ObtenerPorIdAsync(int idUsuario);
        Task<Usuario?> ObtenerPorIdentificacionAsync(string identificacion);
    }

    public class LoginResult
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public Usuario? Usuario { get; set; }
    }
}
