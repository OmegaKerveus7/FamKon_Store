namespace FamKon_store_api.Models.DTOs
{
    public class RegistroRequest
    {
        public string Nombres { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Contrasena { get; set; } = string.Empty;
        public DateTime FechaNacimiento { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string FotoOriginalBase64 { get; set; } = string.Empty;
        public string? FotoEditadaBase64 { get; set; }
    }

    public class RegistroResponse
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public RegistroData? Data { get; set; }
    }

    public class RegistroData
    {
        public int IdUsuario { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string CodigoQr { get; set; } = string.Empty;
    }
}
