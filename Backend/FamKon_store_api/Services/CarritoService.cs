using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace FamKon_store_api.Services
{
    public class CarritoDetalleDto
    {
        public long IdDetalle { get; set; }
        public long IdProducto { get; set; }
        public long? IdArchivoImagen { get; set; }
        public string Producto { get; set; } = "";
        public string Sku { get; set; } = "";
        public long? IdPersonalizacion { get; set; }
        public long? IdArchivoLadoA { get; set; }
        public long? IdArchivoLadoB { get; set; }
        public string? MensajeLadoA { get; set; }
        public string? MensajeLadoB { get; set; }
        public string? ConfigLadoA { get; set; }
        public string? ConfigLadoB { get; set; }
        public string Bloqueada { get; set; } = "N";
        public string? Comentario { get; set; }
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal PrecioPersonaliza { get; set; }
        public decimal Subtotal { get; set; }
    }

    public class CarritoCompletoDto
    {
        public long IdCarrito { get; set; }
        public long IdUsuario { get; set; }
        public long IdSitio { get; set; }
        public string Estado { get; set; } = "";
        public List<CarritoDetalleDto> Detalles { get; set; } = new();
        public decimal Total { get; set; }
    }

    public class CarritoService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<CarritoService> _logger;

        public CarritoService(DBContext dbContext, ILogger<CarritoService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<long> ObtenerOCrearAsync(long idUsuario, long idSitio)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_OBTENER_O_CREAR", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
            command.Parameters.Add("P_ID_SITIO", OracleDbType.Int64).Value = idSitio;

            var oId = new OracleParameter("O_ID_CARRITO", OracleDbType.Int64) { Direction = ParameterDirection.Output };
            command.Parameters.Add(oId);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)oId.Value).ToInt64();
        }

        public async Task<CarritoCompletoDto?> ObtenerCarritoAsync(long idCarrito)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CARRITO.SP_OBTENER_CARRITO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_CARRITO", OracleDbType.Int64).Value = idCarrito;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var carrito = new CarritoCompletoDto { IdCarrito = idCarrito };
                using var reader = await command.ExecuteReaderAsync();

                bool first = true;
                while (await reader.ReadAsync())
                {
                    if (first)
                    {
                        carrito.IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO"));
                        carrito.IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO"));
                        carrito.Estado = reader.GetString(reader.GetOrdinal("ESTADO"));
                        // SUM devuelve NULL cuando el carrito todavía no tiene detalles.
                        var totalOrdinal = reader.GetOrdinal("TOTAL_CARRITO");
                        carrito.Total = reader.IsDBNull(totalOrdinal) ? 0m : reader.GetDecimal(totalOrdinal);
                        first = false;
                    }

                    if (!reader.IsDBNull(reader.GetOrdinal("ID_CARRITO_DETALLE")))
                    {
                        carrito.Detalles.Add(new CarritoDetalleDto
                        {
                            IdDetalle = reader.GetInt64(reader.GetOrdinal("ID_CARRITO_DETALLE")),
                            IdProducto = reader.GetInt64(reader.GetOrdinal("ID_PRODUCTO")),
                            Producto = reader.GetString(reader.GetOrdinal("PRODUCTO")),
                            Sku = reader.GetString(reader.GetOrdinal("SKU")),
                            IdPersonalizacion = reader.IsDBNull(reader.GetOrdinal("ID_PERSONALIZACION")) ? null : reader.GetInt64(reader.GetOrdinal("ID_PERSONALIZACION")),
                            Cantidad = reader.GetInt32(reader.GetOrdinal("CANTIDAD")),
                            PrecioUnitario = reader.GetDecimal(reader.GetOrdinal("PRECIO_UNITARIO")),
                            PrecioPersonaliza = reader.GetDecimal(reader.GetOrdinal("PRECIO_PERSONALIZA")),
                            Subtotal = reader.GetDecimal(reader.GetOrdinal("SUBTOTAL")),
                        });
                    }
                }

                await reader.CloseAsync();
                if (carrito.Detalles.Count > 0)
                {
                    using var imagenes = new OracleCommand(@"
                        SELECT P.ID_PRODUCTO, P.ID_ARCHIVO_IMAGEN
                        FROM PRODUCTO P
                        WHERE EXISTS (SELECT 1 FROM CARRITO_DETALLE D
                                      WHERE D.ID_CARRITO = :id AND D.ID_PRODUCTO = P.ID_PRODUCTO)", connection);
                    imagenes.Parameters.Add("id", OracleDbType.Int64).Value = idCarrito;
                    using var fotos = await imagenes.ExecuteReaderAsync();
                    var porProducto = new Dictionary<long, long?>();
                    while (await fotos.ReadAsync())
                        porProducto[fotos.GetInt64(0)] = fotos.IsDBNull(1) ? null : fotos.GetInt64(1);
                    foreach (var item in carrito.Detalles)
                        item.IdArchivoImagen = porProducto.GetValueOrDefault(item.IdProducto);

                    using var notas = new OracleCommand(@"
                        SELECT D.ID_PERSONALIZACION,
                               PR.ID_ARCHIVO_LADO_A, PR.ID_ARCHIVO_LADO_B,
                               PR.MENSAJE_LADO_A, PR.MENSAJE_LADO_B,
                               PR.CONFIG_LADO_A, PR.CONFIG_LADO_B, PR.BLOQUEADA
                        FROM CARRITO_DETALLE D
                        JOIN PERSONALIZACION PR ON PR.ID_PERSONALIZACION = D.ID_PERSONALIZACION
                        WHERE D.ID_CARRITO = :id", connection);
                    notas.Parameters.Add("id", OracleDbType.Int64).Value = idCarrito;
                    using var mensajes = await notas.ExecuteReaderAsync();
                    var porPersonalizacion = new Dictionary<long, (long? archA, long? archB, string? msgA, string? msgB, string? cfgA, string? cfgB, string bloqueada)>();
                    while (await mensajes.ReadAsync())
                    {
                        var id = mensajes.GetInt64(0);
                        porPersonalizacion[id] = (
                            mensajes.IsDBNull(1) ? null : mensajes.GetInt64(1),
                            mensajes.IsDBNull(2) ? null : mensajes.GetInt64(2),
                            mensajes.IsDBNull(3) ? null : mensajes.GetString(3),
                            mensajes.IsDBNull(4) ? null : mensajes.GetString(4),
                            LeerClob(mensajes, 5),
                            LeerClob(mensajes, 6),
                            mensajes.IsDBNull(7) ? "N" : mensajes.GetString(7));
                    }
                    foreach (var item in carrito.Detalles)
                    {
                        if (item.IdPersonalizacion is not long idPersonalizacion) continue;
                        if (!porPersonalizacion.TryGetValue(idPersonalizacion, out var datos)) continue;
                        item.IdArchivoLadoA = datos.archA;
                        item.IdArchivoLadoB = datos.archB;
                        item.MensajeLadoA = datos.msgA;
                        item.MensajeLadoB = datos.msgB;
                        item.ConfigLadoA = datos.cfgA;
                        item.ConfigLadoB = datos.cfgB;
                        item.Bloqueada = datos.bloqueada;
                        var texto = string.IsNullOrWhiteSpace(datos.msgA) ? datos.msgB : datos.msgA;
                        if (!string.IsNullOrWhiteSpace(texto)) item.Comentario = texto;
                    }
                }
                return first ? null : carrito;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo carrito {Id}", idCarrito);
                return null;
            }
        }

        public async Task<long> AgregarProductoAsync(long idCarrito, long idProducto, long? idPersonalizacion, int cantidad, decimal precioPersonaliza)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_AGREGAR_PRODUCTO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_CARRITO", OracleDbType.Int64).Value = idCarrito;
            command.Parameters.Add("P_ID_PRODUCTO", OracleDbType.Int64).Value = idProducto;
            command.Parameters.Add("P_ID_PERSONALIZACION", OracleDbType.Int64).Value =
                (object?)idPersonalizacion ?? DBNull.Value;
            command.Parameters.Add("P_CANTIDAD", OracleDbType.Int32).Value = cantidad;
            command.Parameters.Add("P_PRECIO_PERSONALIZA", OracleDbType.Decimal).Value = precioPersonaliza;

            var oId = new OracleParameter("O_ID_CARRITO_DETALLE", OracleDbType.Int64) { Direction = ParameterDirection.Output };
            command.Parameters.Add(oId);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)oId.Value).ToInt64();
        }

        /// <summary>Producto al que pertenece una linea del carrito (para validar existencias).</summary>
        public async Task<long?> ObtenerProductoDeDetalleAsync(long idDetalle)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);
            using var command = new OracleCommand(
                "SELECT ID_PRODUCTO FROM CARRITO_DETALLE WHERE ID_CARRITO_DETALLE=:id", connection);
            command.Parameters.Add("id", OracleDbType.Int64).Value = idDetalle;
            var valor = await command.ExecuteScalarAsync();
            return valor is null || valor == DBNull.Value ? null : Convert.ToInt64(valor);
        }

        public async Task ActualizarCantidadAsync(long idDetalle, int cantidad)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_ACTUALIZAR_CANTIDAD", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_CARRITO_DETALLE", OracleDbType.Int64).Value = idDetalle;
            command.Parameters.Add("P_CANTIDAD", OracleDbType.Int32).Value = cantidad;

            await command.ExecuteNonQueryAsync();
        }

        public async Task EliminarDetalleAsync(long idDetalle)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_ELIMINAR_DETALLE", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_CARRITO_DETALLE", OracleDbType.Int64).Value = idDetalle;

            await command.ExecuteNonQueryAsync();
        }

        public async Task AbandonarCarritoAsync(long idCarrito)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_ABANDONAR_CARRITO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_CARRITO", OracleDbType.Int64).Value = idCarrito;

            await command.ExecuteNonQueryAsync();
        }

        private static string? LeerClob(OracleDataReader reader, int ordinal)
        {
            if (reader.IsDBNull(ordinal)) return null;
            using var clob = reader.GetOracleClob(ordinal);
            return clob.IsNull ? null : clob.Value;
        }
    }
}
