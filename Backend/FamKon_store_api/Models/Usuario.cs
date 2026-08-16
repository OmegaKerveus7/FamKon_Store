namespace FamKon_store_api.Models
{
    public class Usuario
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Correo { get; set; }
        public string? NombreUsuario { get; set; }
        public string Contrasena { get; set; } = string.Empty;
        public string ImagenOriginalBase64 { get; set; } = string.Empty;
        public string? CodigoQr { get; set; }
        public int Rol { get; set; }
    }
}