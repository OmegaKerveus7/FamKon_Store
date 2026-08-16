namespace FamKon_store_api.Models
{
    public class ResponseVerificar
    {
        public bool Resultado { get; set; }
        public bool Coincide { get; set; }
        public string Score { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Error { get; set; } = string.Empty;
    }
}