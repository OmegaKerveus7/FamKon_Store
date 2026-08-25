namespace FamKon_store_api.Models.DTOs
{
    public class LoginRequest
    {
        public string? Correo { get; set; }
        public string? Nickname { get; set; }
        public string Contrasena { get; set; } = string.Empty;
    }
}
