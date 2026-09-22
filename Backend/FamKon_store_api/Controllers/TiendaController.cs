using FamKon_store_api.Services;
using Oracle.ManagedDataAccess.Client;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class TiendaController : ControllerBase
    {
        private readonly CatalogoService _catalogo;
        private readonly PermisoService _permisos;
        private readonly CarritoService _carrito;
        private readonly PedidoService _pedido;
        private readonly ILogger<TiendaController> _logger;

        public TiendaController(
            CatalogoService catalogo,
            PermisoService permisos,
            CarritoService carrito,
            PedidoService pedido,
            ILogger<TiendaController> logger)
        {
            _catalogo = catalogo;
            _permisos = permisos;
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
            try
            {
                var productos = await _catalogo.ListarProductosAsync(idSitio, idCategoria, soloActivos);
                return Ok(new { codigoS = 200, productos });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
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
            try
            {
                var categorias = await _catalogo.ListarCategoriasAsync(soloActivas);
                return Ok(new { codigoS = 200, categorias });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
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

        private async Task<bool> PuedeGestionarProductos()
        {
            var id = ObtenerUsuarioId();
            return id.HasValue && (await _permisos.ListarPermisosAsync(id.Value))
                .Any(p => p.CodigoPermiso == "GESTIONAR_PRODUCTOS");
        }

        private ActionResult ErrorProducto(Exception ex)
        {
            _logger.LogError(ex, "Error en gestión de productos");
            var numero = ex is OracleException oracle ? Math.Abs(oracle.Number) : 0;
            var (status, mensaje) = numero switch
            {
                1 or 20302 => (409, "Ya existe un producto con ese SKU."),
                20304 or 20306 => (404, "El producto ya no existe. Actualiza el listado."),
                2291 => (400, "La categoría o la imagen seleccionada ya no existe."),
                20301 or 20303 => (400, "El precio no puede ser negativo."),
                20305 => (400, "El estado del producto no es válido."),
                _ => (500, "No se pudo completar la operación de productos. Intenta nuevamente.")
            };
            return StatusCode(status, new { codigoS = status, mensaje });
        }

        private static bool DatosProductoValidos(long categoria, string nombre, string? descripcion,
            decimal precio, string? ladoA, string? ladoB) =>
            categoria > 0 && !string.IsNullOrWhiteSpace(nombre) && nombre.Length <= 150 &&
            (descripcion?.Length ?? 0) <= 1000 && precio >= 0 && precio <= 9999999999.99m &&
            decimal.Round(precio, 2) == precio && ladoA is "S" or "N" && ladoB is "S" or "N";

        [Authorize]
        [HttpPost("admin/categorias")]
        public async Task<ActionResult> CrearCategoria([FromBody] CrearCategoriaRequest request)
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            if (string.IsNullOrWhiteSpace(request.Codigo) || request.Codigo.Length > 30 ||
                string.IsNullOrWhiteSpace(request.Nombre) || request.Nombre.Length > 100 ||
                (request.Descripcion?.Length ?? 0) > 300)
                return BadRequest(new { mensaje = "Completa código (máximo 30), nombre (máximo 100) y descripción (máximo 300 caracteres)." });
            try
            {
                var codigo = request.Codigo.Trim().ToUpperInvariant();
                var nombre = request.Nombre.Trim();
                var descripcion = request.Descripcion?.Trim() ?? "";
                var id = await _catalogo.CrearCategoriaAsync(codigo, nombre, descripcion);
                return Ok(new { codigoS = 200, categoria = new CategoriaDto {
                    IdCategoria = id, Codigo = codigo, Nombre = nombre, Descripcion = descripcion
                }});
            }
            catch (OracleException ex) when (Math.Abs(ex.Number) is 1 or 20312)
            {
                return Conflict(new { mensaje = "Ya existe una categoría con ese código. Usa otro código o selecciona la categoría existente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando categoría");
                return StatusCode(500, new { mensaje = "No se pudo crear la categoría. Intenta nuevamente." });
            }
        }

        [Authorize]
        [HttpGet("admin/productos")]
        public async Task<ActionResult> ListarProductosAdmin()
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            try
            {
                var productos = await _catalogo.ListarProductosAsync(1, null, "N");
                return Ok(new { codigoS = 200, productos });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
        }

        [Authorize]
        [HttpPost("admin/productos")]
        public async Task<ActionResult> CrearProducto([FromBody] CrearProductoRequest request)
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            if (!DatosProductoValidos(request.IdCategoria, request.Nombre, request.Descripcion,
                    request.PrecioBase, request.PermiteLadoA ?? "S", request.PermiteLadoB ?? "S") ||
                request.IdSitio <= 0 || string.IsNullOrWhiteSpace(request.Sku) || request.Sku.Length > 40)
                return BadRequest(new { mensaje = "Revisa SKU, nombre, categoría, precio y opciones de personalización." });
            try
            {
                var id = await _catalogo.CrearProductoAsync(
                    request.IdSitio, request.IdCategoria, request.IdArchivoImagen,
                    request.Sku.Trim(), request.Nombre.Trim(), request.Descripcion ?? "",
                    request.PrecioBase, request.PermiteLadoA ?? "S", request.PermiteLadoB ?? "S");
                return Ok(new { codigoS = 200, mensaje = "Producto creado.", idProducto = id });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
        }

        [Authorize]
        [HttpPut("admin/productos/{id}")]
        public async Task<ActionResult> ActualizarProducto(long id, [FromBody] ActualizarProductoRequest request)
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            if (id <= 0 || !DatosProductoValidos(request.IdCategoria, request.Nombre, request.Descripcion,
                    request.PrecioBase, request.PermiteLadoA, request.PermiteLadoB))
                return BadRequest(new { mensaje = "Revisa nombre, categoría, precio y opciones de personalización." });
            try
            {
                await _catalogo.ActualizarProductoAsync(
                    id, request.IdCategoria, request.IdArchivoImagen,
                    request.Nombre.Trim(), request.Descripcion ?? "", request.PrecioBase,
                    request.PermiteLadoA, request.PermiteLadoB);
                return Ok(new { codigoS = 200, mensaje = "Producto actualizado." });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
        }

        [Authorize]
        [HttpPut("admin/productos/{id}/estado")]
        public async Task<ActionResult> CambiarEstadoProducto(long id, [FromBody] CambiarEstadoRequest request)
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            if (id <= 0 || request.Activo is not ("S" or "N"))
                return BadRequest(new { mensaje = "El estado del producto no es válido." });
            try
            {
                await _catalogo.CambiarEstadoProductoAsync(id, request.Activo);
                return Ok(new { codigoS = 200, mensaje = "Estado actualizado." });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
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

    public class CrearCategoriaRequest
    {
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string? Descripcion { get; set; }
    }

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
