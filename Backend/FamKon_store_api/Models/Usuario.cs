namespace FamKon_store_api.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public string Nombres { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string? Correo { get; set; }
        public string? Nickname { get; set; }
        public string Contrasena { get; set; } = string.Empty;
        public string? FotoOriginal { get; set; }
        public string? FotoEditada { get; set; }
        public string? CodigoQr { get; set; }
        public int Role { get; set; }
        public DateTime? FechaNacimiento { get; set; }
    }
}
