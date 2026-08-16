namespace FamKon_store_api.Models.DTOs
{
    public class LoginRequest
    {
        public string? Correo { get; set; }
        public string? NombreUsuario { get; set; }
        public string Contrasena { get; set; } = string.Empty;
    }
}