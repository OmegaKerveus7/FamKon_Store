using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class TiendaController : ControllerBase
    {
        private readonly CatalogoService _catalogo;
        private readonly CarritoService _carrito;
        private readonly PedidoService _pedido;
        private readonly ILogger<TiendaController> _logger;

        public TiendaController(
            CatalogoService catalogo,
            CarritoService carrito,
            PedidoService pedido,
            ILogger<TiendaController> logger)
        {
            _catalogo = catalogo;
            _carrito = carrito;
            _pedido = pedido;
            _logger = logger;
        }

        private long? ObtenerUsuarioId()
        {
            var sub = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(sub) || !long.TryParse(sub, out var id)) return null;
            return id;
        }

        // ═══════════════════════════════════════════════════════════════
        //  CATÁLOGO (público)
        // ═══════════════════════════════════════════════════════════════

        [HttpGet("productos")]
        public async Task<ActionResult> ListarProductos(
            [FromQuery] long idSitio = 1,
            [FromQuery] long? idCategoria = null,
            [FromQuery] string soloActivos = "S")
        {
            var productos = await _catalogo.ListarProductosAsync(idSitio, idCategoria, soloActivos);
            return Ok(new { codigoS = 200, productos });
        }

        [HttpGet("productos/{id}")]
        public async Task<ActionResult> ObtenerProducto(long id)
        {
            var producto = await _catalogo.ObtenerProductoAsync(id);
            if (producto is null)
                return Ok(new { codigoS = 404, mensaje = "Producto no encontrado." });
            return Ok(new { codigoS = 200, producto });
        }

        [HttpGet("categorias")]
        public async Task<ActionResult> ListarCategorias([FromQuery] string soloActivas = "S")
        {
            var categorias = await _catalogo.ListarCategoriasAsync(soloActivas);
            return Ok(new { codigoS = 200, categorias });
        }

        [HttpGet("entrega-areas")]
        public async Task<ActionResult> ListarAreasEntrega(
            [FromQuery] long idSitio = 1,
            [FromQuery] string soloActivas = "S")
        {
            var areas = await _catalogo.ListarAreasEntregaAsync(idSitio, soloActivas);
            return Ok(new { codigoS = 200, areas });
        }

        [HttpGet("metodos-pago")]
        public async Task<ActionResult> ListarMetodosPago([FromQuery] string soloActivos = "S")
        {
            var metodos = await _catalogo.ListarMetodosPagoAsync(soloActivos);
            return Ok(new { codigoS = 200, metodos });
        }

        // ═══════════════════════════════════════════════════════════════
        //  PRODUCTOS - ADMIN (requiere auth + rol ADMIN)
        // ═══════════════════════════════════════════════════════════════

        [Authorize]
        [HttpPost("admin/productos")]
        public async Task<ActionResult> CrearProducto([FromBody] CrearProductoRequest request)
        {
            try
            {
                var id = await _catalogo.CrearProductoAsync(
                    request.IdSitio, request.IdCategoria, request.IdArchivoImagen,
                    request.Sku, request.Nombre, request.Descripcion,
                    request.PrecioBase, request.PermiteLadoA ?? "S", request.PermiteLadoB ?? "S");
                return Ok(new { codigoS = 200, mensaje = "Producto creado.", idProducto = id });
            }
            catch (Oracle.ManagedDataAccess.Client.OracleException ex)
            {
                return Ok(new { codigoS = 400, mensaje = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("admin/productos/{id}")]
        public async Task<ActionResult> ActualizarProducto(long id, [FromBody] ActualizarProductoRequest request)
        {
            try
            {
                await _catalogo.ActualizarProductoAsync(
                    id, request.IdCategoria, request.IdArchivoImagen,
                    request.Nombre, request.Descripcion, request.PrecioBase,
                    request.PermiteLadoA, request.PermiteLadoB);
                return Ok(new { codigoS = 200, mensaje = "Producto actualizado." });
            }
            catch (Oracle.ManagedDataAccess.Client.OracleException ex)
            {
                return Ok(new { codigoS = 400, mensaje = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("admin/productos/{id}/estado")]
        public async Task<ActionResult> CambiarEstadoProducto(long id, [FromBody] CambiarEstadoRequest request)
        {
            await _catalogo.CambiarEstadoProductoAsync(id, request.Activo);
            return Ok(new { codigoS = 200, mensaje = "Estado actualizado." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  CARRITO (requiere auth)
        // ═══════════════════════════════════════════════════════════════

        [Authorize]
        [HttpGet("carrito")]
        public async Task<ActionResult> ObtenerCarrito([FromQuery] long idSitio = 1)
        {
            var userId = ObtenerUsuarioId();
            if (userId is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var idCarrito = await _carrito.ObtenerOCrearAsync(userId.Value, idSitio);
            var carrito = await _carrito.ObtenerCarritoAsync(idCarrito);
            if (carrito is null)
                return Ok(new { codigoS = 404, mensaje = "Carrito no encontrado." });
            return Ok(new { codigoS = 200, carrito });
        }

        [Authorize]
        [HttpPost("carrito/productos")]
        public async Task<ActionResult> AgregarAlCarrito([FromBody] AgregarCarritoRequest request)
        {
            var userId = ObtenerUsuarioId();
            if (userId is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var idCarrito = await _carrito.ObtenerOCrearAsync(userId.Value, request.IdSitio);
            var idDetalle = await _carrito.AgregarProductoAsync(
                idCarrito, request.IdProducto, request.IdPersonalizacion,
                request.Cantidad, request.PrecioPersonaliza ?? 0);

            return Ok(new { codigoS = 200, mensaje = "Producto agregado.", idDetalle });
        }

        [Authorize]
        [HttpPut("carrito/detalle/{idDetalle}")]
        public async Task<ActionResult> ActualizarCantidadCarrito(long idDetalle, [FromBody] ActualizarCantidadRequest request)
        {
            await _carrito.ActualizarCantidadAsync(idDetalle, request.Cantidad);
            return Ok(new { codigoS = 200, mensaje = "Cantidad actualizada." });
        }

        [Authorize]
        [HttpDelete("carrito/detalle/{idDetalle}")]
        public async Task<ActionResult> EliminarDelCarrito(long idDetalle)
        {
            await _carrito.EliminarDetalleAsync(idDetalle);
            return Ok(new { codigoS = 200, mensaje = "Producto eliminado." });
        }

        // ═══════════════════════════════════════════════════════════════
        //  PEDIDOS (requiere auth)
        // ═══════════════════════════════════════════════════════════════

        [Authorize]
        [HttpPost("pedidos")]
        public async Task<ActionResult> CrearPedido([FromBody] CrearPedidoRequest request)
        {
            var userId = ObtenerUsuarioId();
            if (userId is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var numeroPedido = $"PED-{DateTime.Now:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
            var tokenQr = Guid.NewGuid().ToString("N");
            var tokenQrHash = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(tokenQr))
            ).ToLower();

            var idPedido = await _pedido.CrearDesdeCarritoAsync(
                request.IdCarrito, request.IdAreaEntrega, numeroPedido,
                tokenQrHash, request.Moneda, request.Referencia, request.Observaciones);

            return Ok(new { codigoS = 200, mensaje = "Pedido creado.", idPedido, numeroPedido, tokenQr });
        }

        [Authorize]
        [HttpGet("pedidos")]
        public async Task<ActionResult> ListarPedidos()
        {
            var userId = ObtenerUsuarioId();
            if (userId is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var pedidos = await _pedido.ListarPorUsuarioAsync(userId.Value);
            return Ok(new { codigoS = 200, pedidos });
        }

        [Authorize]
        [HttpGet("pedidos/{id}")]
        public async Task<ActionResult> ObtenerPedido(long id)
        {
            var resumen = await _pedido.ObtenerResumenAsync(id);
            if (resumen is null)
                return Ok(new { codigoS = 404, mensaje = "Pedido no encontrado." });

            var detalles = await _pedido.ObtenerDetalleAsync(id);
            return Ok(new { codigoS = 200, resumen, detalles });
        }

        [HttpGet("tracking/{tokenHash}")]
        public async Task<ActionResult> ConsultarTracking(string tokenHash)
        {
            var pasos = await _pedido.ConsultarTrackingAsync(tokenHash);
            return Ok(new { codigoS = 200, pasos });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Request DTOs
    // ═══════════════════════════════════════════════════════════════

    public class CrearProductoRequest
    {
        public long IdSitio { get; set; } = 1;
        public long IdCategoria { get; set; }
        public long? IdArchivoImagen { get; set; }
        public string Sku { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string Descripcion { get; set; } = "";
        public decimal PrecioBase { get; set; }
        public string? PermiteLadoA { get; set; }
        public string? PermiteLadoB { get; set; }
    }

    public class ActualizarProductoRequest
    {
        public long IdCategoria { get; set; }
        public long? IdArchivoImagen { get; set; }
        public string Nombre { get; set; } = "";
        public string Descripcion { get; set; } = "";
        public decimal PrecioBase { get; set; }
        public string PermiteLadoA { get; set; } = "S";
        public string PermiteLadoB { get; set; } = "S";
    }

    public class CambiarEstadoRequest
    {
        public string Activo { get; set; } = "S";
    }

    public class AgregarCarritoRequest
    {
        public long IdSitio { get; set; } = 1;
        public long IdProducto { get; set; }
        public long? IdPersonalizacion { get; set; }
        public int Cantidad { get; set; } = 1;
        public decimal? PrecioPersonaliza { get; set; }
    }

    public class ActualizarCantidadRequest
    {
        public int Cantidad { get; set; }
    }

    public class CrearPedidoRequest
    {
        public long IdCarrito { get; set; }
        public long IdAreaEntrega { get; set; }
        public string? Moneda { get; set; }
        public string? Referencia { get; set; }
        public string? Observaciones { get; set; }
    }
}
