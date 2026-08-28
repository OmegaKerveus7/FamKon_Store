namespace FamKon_store_api.Models.DTOs
{
    public class ActualizarFotoRequest
    {
        public string Correo { get; set; } = string.Empty;
        public string Contrasena { get; set; } = string.Empty;
        public string FotoOriginalBase64 { get; set; } = string.Empty;
    }
}
