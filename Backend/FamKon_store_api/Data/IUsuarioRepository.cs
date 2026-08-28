using FamKon_store_api.Models;
using FamKon_store_api.Models.DTOs;

namespace FamKon_store_api.Data
{
    public interface IUsuarioRepository
    {
        Task<LoginResult> LoginPorCredencialesAsync(
            string? correo,
            string? nickname,
            string contrasena);

        Task<LoginResult> LoginPorQrAsync(string codigoQr);

        Task<Usuario?> ObtenerPorIdAsync(int idUsuario);

        Task<Usuario?> ObtenerPorIdentificacionAsync(
            string identificacion);

        Task<Usuario?> ObtenerPorCorreoONicknameAsync(
            string correoONickname);

        Task<RegistroResult> RegistrarCompradorAsync(
            RegistroRequest request);

        Task<bool> ActualizarFotoAsync(
            int idUsuario, string fotoOriginalBase64);
    }

    public class LoginResult
    {
        public int CodigoS { get; set; }

        public string Mensaje { get; set; } = string.Empty;

        public Usuario? Usuario { get; set; }
    }

    public class RegistroResult
    {
        public int CodigoS { get; set; }

        public string Mensaje { get; set; } = string.Empty;

        public RegistroData? Data { get; set; }
    }
}