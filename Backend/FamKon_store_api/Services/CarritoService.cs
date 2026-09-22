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
        public string Producto { get; set; } = "";
        public string Sku { get; set; } = "";
        public long? IdPersonalizacion { get; set; }
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

        public async Task<long> CrearPersonalizacionAsync(long? idArchivoLadoA, long? idArchivoLadoB, string? mensajeLadoA, string? mensajeLadoB, string? configLadoA, string? configLadoB)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CARRITO.SP_CREAR_PERSONALIZACION", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_ARCHIVO_LADO_A", OracleDbType.Int64).Value = (object?)idArchivoLadoA ?? DBNull.Value;
            command.Parameters.Add("P_ID_ARCHIVO_LADO_B", OracleDbType.Int64).Value = (object?)idArchivoLadoB ?? DBNull.Value;
            command.Parameters.Add("P_MENSAJE_LADO_A", OracleDbType.Varchar2).Value = (object?)mensajeLadoA ?? DBNull.Value;
            command.Parameters.Add("P_MENSAJE_LADO_B", OracleDbType.Varchar2).Value = (object?)mensajeLadoB ?? DBNull.Value;
            command.Parameters.Add("P_CONFIG_LADO_A", OracleDbType.Varchar2).Value = (object?)configLadoA ?? DBNull.Value;
            command.Parameters.Add("P_CONFIG_LADO_B", OracleDbType.Varchar2).Value = (object?)configLadoB ?? DBNull.Value;

            var oId = new OracleParameter("O_ID_PERSONALIZACION", OracleDbType.Int64) { Direction = ParameterDirection.Output };
            command.Parameters.Add(oId);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)oId.Value).ToInt64();
        }
    }
}
