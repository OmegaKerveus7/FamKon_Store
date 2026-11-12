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
        private readonly PersonalizacionService _personalizacion;
        private readonly ILogger<TiendaController> _logger;

        public TiendaController(
            CatalogoService catalogo,
            PermisoService permisos,
            CarritoService carrito,
            PedidoService pedido,
            PersonalizacionService personalizacion,
            ILogger<TiendaController> logger)
        {
            _catalogo = catalogo;
            _permisos = permisos;
            _carrito = carrito;
            _pedido = pedido;
            _personalizacion = personalizacion;
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
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("catalogo")]
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
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("catalogo")]
        public async Task<ActionResult> ObtenerProducto(long id)
        {
            var producto = await _catalogo.ObtenerProductoAsync(id);
            // Los productos inactivos no se muestran al comprador (solo a quien gestiona productos).
            if (producto is null || (producto.Activo != "S" && !await PuedeGestionarProductos()))
                return Ok(new { codigoS = 404, mensaje = "Producto no encontrado." });
            return Ok(new { codigoS = 200, producto });
        }

        [HttpGet("categorias")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("catalogo")]
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

        public record TarifaEntregaRequest(decimal CargoEntrega);
        [Authorize, HttpPut("admin/entrega-areas/{id:long}/tarifa")]
        public async Task<ActionResult> ActualizarTarifa(long id, TarifaEntregaRequest request, [FromServices] FamKon_store_api.BD.DBContext db)
        {
            var actor = ObtenerUsuarioId();
            if (!actor.HasValue || !(await _permisos.ListarPermisosAsync(actor.Value)).Any(p => p.CodigoPermiso == "GESTIONAR_CATALOGOS")) return Forbid();
            if (request.CargoEntrega < 0 || request.CargoEntrega > 9999999999.99m || decimal.Round(request.CargoEntrega, 2) != request.CargoEntrega)
                return BadRequest(new { mensaje = "Ingresa una tarifa válida con hasta dos decimales." });
            using var c = db.CreateConnection(); await db.OpenConnectionAsync(c); c.ClientId = actor.Value.ToString();
            using var cmd = new OracleCommand("UPDATE AREA_ENTREGA SET CARGO_ENTREGA=:cargo WHERE ID_AREA_ENTREGA=:id AND ID_SITIO=1 AND ACTIVO='S'", c);
            cmd.Parameters.Add("cargo", OracleDbType.Decimal).Value = request.CargoEntrega;
            cmd.Parameters.Add("id", OracleDbType.Int64).Value = id;
            if (await cmd.ExecuteNonQueryAsync() == 0) return NotFound();
            return Ok(new { mensaje = "Tarifa actualizada. Aplica a pedidos nuevos." });
        }

        [Authorize, HttpPost("admin/productos/imagen"), Consumes("multipart/form-data"), RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<ActionResult> SubirImagenProducto(IFormFile archivo, [FromServices] ArchivoService archivos)
        {
            if (!await PuedeGestionarProductos()) return Forbid();
            if (archivo.Length == 0 || archivo.Length > 5 * 1024 * 1024)
                return BadRequest(new { mensaje = "Selecciona una imagen de hasta 5 MB." });
            using var ms = new MemoryStream();
            await archivo.CopyToAsync(ms);
            var bytes = ms.ToArray();
            var mime = bytes.Length >= 8 && bytes.Take(8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}) ? "image/png"
                : bytes.Length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255 ? "image/jpeg" : null;
            if (mime == null) return BadRequest(new { mensaje = "Solo se permiten imágenes JPG o PNG." });
            var guardado = await archivos.GuardarArchivoAsync(ObtenerUsuarioId()!.Value, "IMAGEN_PRODUCTO", Path.GetFileName(archivo.FileName), mime, bytes);
            return guardado == null ? StatusCode(500, new { mensaje = "No se pudo guardar la imagen." }) : Ok(new { idArchivo = guardado.IdArchivo });
        }

        [Authorize, HttpPut("admin/productos/{id:long}/galeria")]
        public async Task<ActionResult> GuardarGaleria(long id, [FromBody] long[] imagenes, [FromServices] FamKon_store_api.BD.DBContext db)
        {
            if (!await PuedeGestionarProductos()) return Forbid();
            if (imagenes.Length > 8 || imagenes.Distinct().Count() != imagenes.Length) return BadRequest(new { mensaje = "Selecciona hasta 8 imágenes distintas." });
            using var c = db.CreateConnection(); await db.OpenConnectionAsync(c);
            using var tx = c.BeginTransaction();
            using var lockRow = new OracleCommand("SELECT ID_PRODUCTO FROM PRODUCTO WHERE ID_PRODUCTO=:id FOR UPDATE", c);
            lockRow.Parameters.Add("id", OracleDbType.Int64).Value = id;
            if (await lockRow.ExecuteScalarAsync() == null) return NotFound();
            foreach (var archivo in imagenes) {
                using var validar = new OracleCommand("SELECT COUNT(*) FROM ARCHIVO WHERE ID_ARCHIVO=:id AND TIPO_ARCHIVO='IMAGEN_PRODUCTO'", c);
                validar.Parameters.Add("id", OracleDbType.Int64).Value = archivo;
                if (Convert.ToInt32(await validar.ExecuteScalarAsync()) != 1) return BadRequest(new { mensaje = "Imagen no válida." });
            }
            using var borrar = new OracleCommand("DELETE FROM PRODUCTO_IMAGEN WHERE ID_PRODUCTO=:id", c);
            borrar.Parameters.Add("id", OracleDbType.Int64).Value = id;
            try { await borrar.ExecuteNonQueryAsync(); }
            catch (OracleException ex) when (ex.Number == 942 && imagenes.Length == 0) {
                tx.Commit(); return Ok(new { mensaje = "Imagen principal guardada." });
            }
            for (var i=0; i<imagenes.Length; i++) {
                using var insertar = new OracleCommand("INSERT INTO PRODUCTO_IMAGEN (ID_PRODUCTO,ID_ARCHIVO,ORDEN) VALUES (:producto,:archivo,:orden)", c);
                insertar.Parameters.Add("producto", OracleDbType.Int64).Value = id;
                insertar.Parameters.Add("archivo", OracleDbType.Int64).Value = imagenes[i];
                insertar.Parameters.Add("orden", OracleDbType.Int32).Value = i;
                await insertar.ExecuteNonQueryAsync();
            }
            tx.Commit(); return Ok(new { mensaje = "Galería guardada." });
        }

        [HttpGet("productos/{id:long}/galeria")]
        public async Task<ActionResult> Galeria(long id, [FromServices] FamKon_store_api.BD.DBContext db)
        {
            var p = await _catalogo.ObtenerProductoAsync(id);
            if (p == null || (p.Activo != "S" && !await PuedeGestionarProductos())) return NotFound();
            var ids = new List<long>(); if (p.IdArchivoImagen.HasValue) ids.Add(p.IdArchivoImagen.Value);
            using var c = db.CreateConnection(); await db.OpenConnectionAsync(c);
            try {
                using var cmd = new OracleCommand("SELECT ID_ARCHIVO FROM PRODUCTO_IMAGEN WHERE ID_PRODUCTO=:id ORDER BY ORDEN", c);
                cmd.Parameters.Add("id", OracleDbType.Int64).Value = id;
                using var reader = await cmd.ExecuteReaderAsync(); while (await reader.ReadAsync()) if (!ids.Contains(reader.GetInt64(0))) ids.Add(reader.GetInt64(0));
            } catch (OracleException ex) when (ex.Number == 942) { }
            return Ok(ids);
        }

        [HttpGet("productos/{id:long}/imagen")]
        [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("catalogo")]
        public async Task<ActionResult> ImagenProducto(long id, [FromServices] ArchivoService archivos, [FromServices] FamKon_store_api.BD.DBContext db, [FromQuery] long? archivo = null)
        {
            var producto = await _catalogo.ObtenerProductoAsync(id);
            if (producto?.IdArchivoImagen == null || producto.Activo != "S") return NotFound();
            var imagen = producto.IdArchivoImagen.Value;
            if (archivo.HasValue && archivo != imagen) {
                using var c = db.CreateConnection(); await db.OpenConnectionAsync(c);
                using var cmd = new OracleCommand("SELECT COUNT(*) FROM PRODUCTO_IMAGEN WHERE ID_PRODUCTO=:producto AND ID_ARCHIVO=:archivo", c);
                cmd.Parameters.Add("producto", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("archivo", OracleDbType.Int64).Value = archivo.Value;
                if (Convert.ToInt32(await cmd.ExecuteScalarAsync()) != 1) return NotFound();
                imagen = archivo.Value;
            }
            var (contenido, mime, _) = await archivos.ObtenerArchivoAsync(imagen);
            if (contenido == null || mime is not ("image/png" or "image/jpeg")) return NotFound();
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, max-age=300";
            return File(contenido, mime);
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
                if (request.Existencia is int existenciaInicial)
                    await _catalogo.ActualizarExistenciaAsync(id, existenciaInicial);
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
                if (request.Existencia is int existencia)
                    await _catalogo.ActualizarExistenciaAsync(id, existencia);
                return Ok(new { codigoS = 200, mensaje = "Producto actualizado." });
            }
            catch (Exception ex) { return ErrorProducto(ex); }
        }

        [Authorize]
        [HttpPut("admin/productos/{id}/existencia")]
        public async Task<ActionResult> ActualizarExistenciaProducto(long id, [FromBody] ActualizarExistenciaRequest request)
        {
            if (!await PuedeGestionarProductos())
                return StatusCode(403, new { mensaje = "No tienes permiso para gestionar productos." });
            if (id <= 0 || request.Existencia < 0 || request.Existencia > 1_000_000)
                return BadRequest(new { mensaje = "Ingresa una existencia entre 0 y 1.000.000." });
            try
            {
                return await _catalogo.ActualizarExistenciaAsync(id, request.Existencia)
                    ? Ok(new { codigoS = 200, mensaje = "Existencia actualizada.", existencia = request.Existencia })
                    : NotFound(new { codigoS = 404, mensaje = "Producto no encontrado." });
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

            var idPersonalizacion = request.IdPersonalizacion;
            try
            {
                if (request.Personalizacion is not null)
                {
                    idPersonalizacion = await _personalizacion.CrearAsync(
                        userId.Value, request.IdProducto, request.Personalizacion);
                }
                else if (idPersonalizacion is long existente)
                {
                    if (!await _personalizacion.PuedeUsarEnCarritoAsync(userId.Value, existente, request.IdProducto))
                        return BadRequest(new { codigoS = 400, mensaje = "La personalización no pertenece al usuario o al producto." });
                }
                else
                {
                    var comentario = request.Comentario?.Trim();
                    if (!string.IsNullOrEmpty(comentario))
                    {
                        if (comentario.Length > 500)
                            return BadRequest(new { codigoS = 400, mensaje = "Las indicaciones no pueden superar los 500 caracteres." });

                        idPersonalizacion = await _personalizacion.CrearAsync(
                            userId.Value, request.IdProducto,
                            new PersonalizacionContenido { MensajeLadoA = comentario });
                    }
                }
            }
            catch (Exception ex) when (ex is OracleException or InvalidOperationException)
            {
                var mensaje = ex is InvalidOperationException
                    ? ex.Message
                    : ex.Message.Split('\n')[0].Split(':', 2).Last().Trim();
                return BadRequest(new { codigoS = 400, mensaje });
            }

            var idCarrito = await _carrito.ObtenerOCrearAsync(userId.Value, request.IdSitio);

            var producto = await _catalogo.ObtenerProductoAsync(request.IdProducto);
            if (producto is null || producto.Activo != "S")
                return BadRequest(new { codigoS = 400, mensaje = "El producto ya no está disponible." });
            if (request.Cantidad <= 0)
                return BadRequest(new { codigoS = 400, mensaje = "La cantidad debe ser mayor a cero." });
            var carritoActual = await _carrito.ObtenerCarritoAsync(idCarrito);
            var enCarrito = carritoActual?.Detalles.Where(d => d.IdProducto == request.IdProducto).Sum(d => d.Cantidad) ?? 0;
            if (enCarrito + request.Cantidad > producto.Existencia)
                return BadRequest(new { codigoS = 400, mensaje = $"Solo hay {producto.Existencia} disponibles de {producto.Nombre}." });

            var idDetalle = await _carrito.AgregarProductoAsync(
                idCarrito, request.IdProducto, idPersonalizacion,
                request.Cantidad, 0);

            return Ok(new { codigoS = 200, mensaje = "Producto agregado.", idDetalle });
        }

        [Authorize]
        [HttpPut("carrito/detalle/{idDetalle}")]
        public async Task<ActionResult> ActualizarCantidadCarrito(long idDetalle, [FromBody] ActualizarCantidadRequest request)
        {
            if (request.Cantidad <= 0)
                return BadRequest(new { codigoS = 400, mensaje = "La cantidad debe ser mayor a cero." });

            var idProducto = await _carrito.ObtenerProductoDeDetalleAsync(idDetalle);
            if (idProducto is null)
                return NotFound(new { codigoS = 404, mensaje = "El producto del carrito no existe." });

            var producto = await _catalogo.ObtenerProductoAsync(idProducto.Value);
            if (producto is not null && request.Cantidad > producto.Existencia)
                return BadRequest(new { codigoS = 400, mensaje = $"Solo hay {producto.Existencia} disponibles de {producto.Nombre}." });

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
        [NonAction]
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

            if (resumen.IdUsuario != ObtenerUsuarioId()) return NotFound();
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
        public int? Existencia { get; set; }
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
        public int? Existencia { get; set; }
    }

    public class ActualizarExistenciaRequest
    {
        public int Existencia { get; set; }
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
        public PersonalizacionContenido? Personalizacion { get; set; }
        public int Cantidad { get; set; } = 1;
        public string? Comentario { get; set; }
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
