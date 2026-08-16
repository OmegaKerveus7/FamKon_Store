namespace FamKon_store_api.Models
{
    public class ResponseSegmentar
    {
        public bool Resultado { get; set; }
        public bool Segmentado { get; set; }
        public string Rostro { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }
}