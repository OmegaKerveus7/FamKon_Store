namespace FamKon_store_api.Models.DTOs
{
    public class LoginResponse
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public Usuario? Data { get; set; }
    }
}
