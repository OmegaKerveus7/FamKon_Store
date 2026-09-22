using System.ComponentModel.DataAnnotations;
namespace FamKon_store_api.Models.Compras;
public class DireccionCompra {
    [Required, StringLength(25), RegularExpression(@"\+?[0-9 ()-]{8,25}")] public string TelefonoContacto { get; set; } = "";
    [StringLength(25), RegularExpression(@"\+?[0-9 ()-]{8,25}")] public string? TelefonoAlterno { get; set; }
    [StringLength(100)] public string? Departamento { get; set; }
    [StringLength(100)] public string? Municipio { get; set; }
    [StringLength(500)] public string? DireccionEntrega { get; set; }
    [StringLength(300)] public string? ReferenciaEntrega { get; set; }
}
public class CrearCompraRequest : DireccionCompra {
    [Range(1,long.MaxValue)] public long IdCarrito { get; set; }
    [Range(1,2)] public int IdModalidadEntrega { get; set; }
    [Required, RegularExpression("^(EFECTIVO|TARJETA)$")] public string MetodoPago { get; set; } = "EFECTIVO";
}
public class EstadoCompraRequest {
    [Required, StringLength(35)] public string Estado { get; set; } = "";
    [StringLength(500)] public string? Comentario { get; set; }
}
public class AsignarCompraRequest { [Range(1,long.MaxValue)] public long IdRepartidor { get; set; } }
public class ResultadoCompraRequest {
    [Required, RegularExpression("^(ENTREGADO|RECOGIDO|COMPRADOR_NO_ENCONTRADO)$")] public string Resultado { get; set; } = "";
    [StringLength(150)] public string? NombreReceptor { get; set; }
    [Range(1,long.MaxValue)] public long? IdArchivoEvidencia { get; set; }
    [Range(0,999999999999.99)] public decimal MontoEfectivo { get; set; }
    [StringLength(500)] public string? Comentario { get; set; }
}
public class CorregirCompraRequest : DireccionCompra { [Required,StringLength(500)] public string Motivo { get; set; } = ""; }
