namespace FamKon_store_api.Models.DTOs
{
    public class CarnetLoginRequest
    {
        public string? CodigoQr { get; set; }
        public string? Identificacion { get; set; }
    }

    public class FacialLoginRequest
    {
        public string? Identificacion { get; set; }
        public string? ImagenOriginalBase64 { get; set; }
        public string? ImagenCompararBase64 { get; set; }
    }
}
