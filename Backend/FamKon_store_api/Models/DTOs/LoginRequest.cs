namespace FamKon_store_api.Models.DTOs
{
    public class LoginRequest
    {
        public string? Correo { get; set; }
        public string? Nickname { get; set; }
        public string? Contrasena { get; set; }
    }

    public class LoginResponse
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public string? Token { get; set; }
        public Usuario? Usuario { get; set; }
    }
}
