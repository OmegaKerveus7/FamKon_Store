namespace FamKon_store_api.Models.DTOs
{
    public enum CanalVerificacion
    {
        EMAIL,
        WHATSAPP,
        AMBOS
    }

    public class EnviarCodigoRequest
    {
        public string Codigo { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string Canal { get; set; } = "EMAIL";
    }

    public class EnviarCodigoResponse
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public bool EmailEnviado { get; set; }
        public bool WhatsAppEnviado { get; set; }
        public int MinutosExpiracion { get; set; } = 5;
    }
}
