namespace FamKon_store_api.Models.DTOs
{
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