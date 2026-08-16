namespace FamKon_store_api.Models.DTOs
{
    public class FacialLoginRequest
    {
        public string ImagenOriginalBase64 { get; set; } = string.Empty;
        public string ImagenCompararBase64 { get; set; } = string.Empty;
        public string? Identificacion { get; set; }
    }
}