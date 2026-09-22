namespace FamKon_store_api.Models
{
    public class Usuario
    {
        public long IdUsuario { get; set; }
        public string Correo { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public DateTime? FechaNacimiento { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Activo { get; set; } = "S";
        public string Bloqueado { get; set; } = "N";
        public string? Roles { get; set; }
    }
}
