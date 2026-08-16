namespace FamKon_store_api.Models.DTOs
{
    public class CarnetLoginRequest
    {
        public string CarnetImagenBase64 { get; set; } = string.Empty;
        public string? CodigoQr { get; set; }
        public string? Identificacion { get; set; }
    }
}