using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon/repartidor")]
    [Authorize]
    public class RepartidorController : ControllerBase
    {
        private readonly RepartidorService _repartidor;
        private readonly ArchivoService _archivo;
        private readonly ILogger<RepartidorController> _logger;

        public RepartidorController(
            RepartidorService repartidor,
            ArchivoService archivo,
            ILogger<RepartidorController> logger)
        {
            _repartidor = repartidor;
            _archivo = archivo;
            _logger = logger;
        }

        private long? ObtenerUsuarioId()
        {
            var sub = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(sub) || !long.TryParse(sub, out var id)) return null;
            return id;
        }

        // ─── Entregas asignadas al repartidor autenticado ───────────────────────
        [HttpGet("entregas")]
        public async Task<ActionResult> MisEntregas()
        {
            var id = ObtenerUsuarioId();
            if (id is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var lista = await _repartidor.ListarEntregasAsync(id.Value);
            return Ok(new { codigoS = 200, entregas = lista });
        }

        // ─── Entregas asignadas a un repartidor especifico (admin/supervisor) ──
        [HttpGet("entregas/{idRepartidor:long}")]
        public async Task<ActionResult> EntregasDe(long idRepartidor)
        {
            var lista = await _repartidor.ListarEntregasAsync(idRepartidor);
            return Ok(new { codigoS = 200, entregas = lista });
        }

        // ─── Pedidos LISTO_ENTREGA sin entrega activa (para asignar) ──────────
        [HttpGet("pedidos-disponibles")]
        public async Task<ActionResult> PedidosDisponibles()
        {
            var lista = await _repartidor.ListarPedidosParaEntregaAsync();
            return Ok(new { codigoS = 200, pedidos = lista });
        }

        // ─── Lista de repartidores activos (para el combo "Asignar a") ────────
        [HttpGet("repartidores")]
        public async Task<ActionResult> ListarRepartidores()
        {
            var lista = await _repartidor.ListarRepartidoresAsync();
            return Ok(new { codigoS = 200, repartidores = lista });
        }

        // ─── Asignar un pedido a un repartidor ────────────────────────────────
        [HttpPost("asignar")]
        public async Task<ActionResult> Asignar([FromBody] AsignarEntregaRequest request)
        {
            if (request.IdPedido <= 0 || request.IdRepartidor <= 0)
            {
                return Ok(new { codigoS = 400, mensaje = "idPedido e idRepartidor son obligatorios." });
            }

            var resultado = await _repartidor.AsignarEntregaAsync(
                request.IdPedido, request.IdRepartidor);

            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje,
                idEntrega = resultado.Id
            });
        }

        // ─── Cambiar estado de un pedido (PAGO_CONFIRMADO -> LISTO_ENTREGA, etc) ──
        [HttpPost("cambiar-estado")]
        public async Task<ActionResult> CambiarEstado([FromBody] CambiarEstadoPedidoRequest request)
        {
            var idActor = ObtenerUsuarioId();
            if (idActor is null)
            {
                return Ok(new { codigoS = 401, mensaje = "No autorizado." });
            }

            if (string.IsNullOrWhiteSpace(request.CodigoEstado))
            {
                return Ok(new { codigoS = 400, mensaje = "codigoEstado es obligatorio." });
            }

            var resultado = await _repartidor.CambiarEstadoPedidoAsync(
                request.IdPedido, request.CodigoEstado, idActor.Value, request.Comentario);

            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje
            });
        }

        // ─── Registrar resultado de entrega (ENTREGADA / NO_ENCONTRADO / CANCELADA) ──
        [HttpPost("resultado")]
        public async Task<ActionResult> RegistrarResultado(
            [FromBody] RegistrarResultadoEntregaRequest request)
        {
            var idActor = ObtenerUsuarioId();
            if (idActor is null)
            {
                return Ok(new { codigoS = 401, mensaje = "No autorizado." });
            }

            if (string.IsNullOrWhiteSpace(request.CodigoEstado))
            {
                return Ok(new { codigoS = 400, mensaje = "codigoEstado es obligatorio." });
            }

            var resultado = await _repartidor.RegistrarResultadoEntregaAsync(
                request.IdEntrega, request.CodigoEstado, idActor.Value,
                request.MontoEfectivo, request.Observaciones,
                request.IdArchivoEvidencia);

            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje
            });
        }

        // ─── Subir evidencia de entrega (foto) ───────────────────────────────
        // Recibe multipart/form-data con un archivo de imagen.
        // Sube el blob a PKG_ARCHIVO y devuelve el idArchivo generado.
        [HttpPost("evidencia")]
        [RequestSizeLimit(15 * 1024 * 1024)]
        public async Task<ActionResult> SubirEvidencia(IFormFile archivo)
        {
            var idActor = ObtenerUsuarioId();
            if (idActor is null)
            {
                return Ok(new { codigoS = 401, mensaje = "No autorizado." });
            }
            if (archivo == null || archivo.Length == 0)
            {
                return Ok(new { codigoS = 400, mensaje = "No se recibio el archivo." });
            }

            string mime = archivo.ContentType ?? "application/octet-stream";
            if (!mime.StartsWith("image/"))
            {
                return Ok(new { codigoS = 400, mensaje = "Solo se permiten imagenes." });
            }

            byte[] bytes;
            await using (var ms = new MemoryStream())
            {
                await archivo.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            var guardado = await _archivo.GuardarArchivoAsync(
                idUsuarioCarga: idActor.Value,
                tipoArchivo: "EVIDENCIA_ENTREGA",
                nombreArchivo: archivo.FileName,
                mimeType: mime,
                contenido: bytes);

            if (guardado is null)
            {
                return Ok(new { codigoS = 500, mensaje = "No se pudo guardar la evidencia." });
            }

            return Ok(new
            {
                codigoS = 200,
                mensaje = "Evidencia guardada.",
                idArchivo = guardado.IdArchivo,
                tamanoBytes = guardado.TamanoBytes
            });
        }

        // ─── Listado completo de entregas (tracking) ────────────────────────
        [HttpGet("tracking")]
        public async Task<ActionResult> Tracking([FromQuery] string? estado = null)
        {
            var lista = await _repartidor.ListarTodasLasEntregasAsync(estado);
            return Ok(new { codigoS = 200, entregas = lista });
        }
    }

    // ─── Controller aparte para descargar las imagenes (no requiere auth especial) ─
    [ApiController]
    [Route("api/famkon/archivos")]
    [Authorize]
    public class ArchivosController : ControllerBase
    {
        private readonly ArchivoService _archivo;

        public ArchivosController(ArchivoService archivo)
        {
            _archivo = archivo;
        }

        [HttpGet("{id:long}")]
        public async Task<IActionResult> Descargar(long id)
        {
            var (contenido, mime, nombre) = await _archivo.ObtenerArchivoAsync(id);
            if (contenido == null || contenido.Length == 0)
                return NotFound();

            return File(contenido, mime, nombre);
        }
    }

    public class AsignarEntregaRequest
    {
        public long IdPedido { get; set; }
        public long IdRepartidor { get; set; }
    }

    public class CambiarEstadoPedidoRequest
    {
        public long IdPedido { get; set; }
        public string CodigoEstado { get; set; } = string.Empty;
        public string? Comentario { get; set; }
    }

    public class RegistrarResultadoEntregaRequest
    {
        public long IdEntrega { get; set; }
        public string CodigoEstado { get; set; } = string.Empty;
        public decimal MontoEfectivo { get; set; }
        public long? IdArchivoEvidencia { get; set; }
        public string? Observaciones { get; set; }
    }
}
