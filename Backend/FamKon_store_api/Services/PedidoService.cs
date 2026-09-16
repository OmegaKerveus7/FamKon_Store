using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace FamKon_store_api.Services
{
    public class PedidoResumenDto
    {
        public long IdPedido { get; set; }
        public long IdUsuario { get; set; }
        public long IdSitio { get; set; }
        public string NumeroPedido { get; set; } = "";
        public string Estado { get; set; } = "";
        public decimal Subtotal { get; set; }
        public decimal CargoEntrega { get; set; }
        public decimal Total { get; set; }
        public string Moneda { get; set; } = "GTQ";
        public DateTime FechaPedido { get; set; }
    }

    public class PedidoDetalleDto
    {
        public long IdDetalle { get; set; }
        public long IdProducto { get; set; }
        public int NumeroLinea { get; set; }
        public string SkuProducto { get; set; } = "";
        public string NombreProducto { get; set; } = "";
        public int Cantidad { get; set; }
        public decimal PrecioUnitario { get; set; }
        public decimal PrecioPersonaliza { get; set; }
        public decimal Subtotal { get; set; }
    }

    public class TrackingPasoDto
    {
        public string Estado { get; set; } = "";
        public DateTime FechaEstado { get; set; }
        public string? Comentario { get; set; }
        public string? Actor { get; set; }
    }

    public class PedidoService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<PedidoService> _logger;

        public PedidoService(DBContext dbContext, ILogger<PedidoService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<long> CrearDesdeCarritoAsync(long idCarrito, long idAreaEntrega, string numeroPedido, string tokenQrHash, string? moneda, string? referencia, string? observaciones)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_PEDIDO.SP_CREAR_DESDE_CARRITO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_CARRITO", OracleDbType.Int64).Value = idCarrito;
            command.Parameters.Add("P_ID_AREA_ENTREGA", OracleDbType.Int64).Value = idAreaEntrega;
            command.Parameters.Add("P_NUMERO_PEDIDO", OracleDbType.Varchar2).Value = numeroPedido;
            command.Parameters.Add("P_TOKEN_QR_HASH", OracleDbType.Varchar2).Value = tokenQrHash;
            command.Parameters.Add("P_COD_MONEDA", OracleDbType.Varchar2).Value = moneda ?? "GTQ";
            command.Parameters.Add("P_REFERENCIA_ENTREGA", OracleDbType.Varchar2).Value = (object?)referencia ?? DBNull.Value;
            command.Parameters.Add("P_OBSERVACIONES", OracleDbType.Varchar2).Value = (object?)observaciones ?? DBNull.Value;

            var oId = new OracleParameter("O_ID_PEDIDO", OracleDbType.Int64) { Direction = ParameterDirection.Output };
            command.Parameters.Add(oId);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)oId.Value).ToInt64();
        }

        public async Task<PedidoResumenDto?> ObtenerResumenAsync(long idPedido)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_PEDIDO.SP_OBTENER_RESUMEN", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new PedidoResumenDto
                    {
                        IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                        IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO")),
                        IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                        NumeroPedido = reader.GetString(reader.GetOrdinal("NUMERO_PEDIDO")),
                        Estado = reader.GetString(reader.GetOrdinal("ESTADO")),
                        Subtotal = reader.GetDecimal(reader.GetOrdinal("SUBTOTAL")),
                        CargoEntrega = reader.GetDecimal(reader.GetOrdinal("CARGO_ENTREGA")),
                        Total = reader.GetDecimal(reader.GetOrdinal("TOTAL")),
                        Moneda = reader.GetString(reader.GetOrdinal("COD_MONEDA")),
                        FechaPedido = reader.GetDateTime(reader.GetOrdinal("FECHA_PEDIDO")),
                    };
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo resumen pedido {Id}", idPedido);
                return null;
            }
        }

        public async Task<List<PedidoDetalleDto>> ObtenerDetalleAsync(long idPedido)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_PEDIDO.SP_OBTENER_DETALLE", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var detalles = new List<PedidoDetalleDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    detalles.Add(new PedidoDetalleDto
                    {
                        IdDetalle = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO_DETALLE")),
                        IdProducto = reader.GetInt64(reader.GetOrdinal("ID_PRODUCTO")),
                        NumeroLinea = reader.GetInt32(reader.GetOrdinal("NUMERO_LINEA")),
                        SkuProducto = reader.GetString(reader.GetOrdinal("SKU_PRODUCTO")),
                        NombreProducto = reader.GetString(reader.GetOrdinal("NOMBRE_PRODUCTO")),
                        Cantidad = reader.GetInt32(reader.GetOrdinal("CANTIDAD")),
                        PrecioUnitario = reader.GetDecimal(reader.GetOrdinal("PRECIO_UNITARIO")),
                        PrecioPersonaliza = reader.GetDecimal(reader.GetOrdinal("PRECIO_PERSONALIZA")),
                        Subtotal = reader.GetDecimal(reader.GetOrdinal("SUBTOTAL")),
                    });
                }
                return detalles;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo detalle pedido {Id}", idPedido);
                return new List<PedidoDetalleDto>();
            }
        }

        public async Task<List<PedidoResumenDto>> ListarPorUsuarioAsync(long idUsuario)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_PEDIDO.SP_LISTAR_POR_USUARIO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var pedidos = new List<PedidoResumenDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    pedidos.Add(new PedidoResumenDto
                    {
                        IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                        IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO")),
                        IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                        NumeroPedido = reader.GetString(reader.GetOrdinal("NUMERO_PEDIDO")),
                        Estado = reader.GetString(reader.GetOrdinal("ESTADO")),
                        Subtotal = reader.GetDecimal(reader.GetOrdinal("SUBTOTAL")),
                        CargoEntrega = reader.GetDecimal(reader.GetOrdinal("CARGO_ENTREGA")),
                        Total = reader.GetDecimal(reader.GetOrdinal("TOTAL")),
                        Moneda = reader.GetString(reader.GetOrdinal("COD_MONEDA")),
                        FechaPedido = reader.GetDateTime(reader.GetOrdinal("FECHA_PEDIDO")),
                    });
                }
                return pedidos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando pedidos usuario {Id}", idUsuario);
                return new List<PedidoResumenDto>();
            }
        }

        public async Task<List<TrackingPasoDto>> ConsultarTrackingAsync(string tokenQrHash)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_PEDIDO.SP_CONSULTAR_TRACKING", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_TOKEN_QR_HASH", OracleDbType.Varchar2).Value = tokenQrHash;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var pasos = new List<TrackingPasoDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    pasos.Add(new TrackingPasoDto
                    {
                        Estado = reader.GetString(reader.GetOrdinal("ESTADO")),
                        FechaEstado = reader.GetDateTime(reader.GetOrdinal("FECHA_ESTADO")),
                        Comentario = reader.IsDBNull(reader.GetOrdinal("COMENTARIO")) ? null : reader.GetString(reader.GetOrdinal("COMENTARIO")),
                        Actor = reader.IsDBNull(reader.GetOrdinal("ACTOR")) ? null : reader.GetString(reader.GetOrdinal("ACTOR")),
                    });
                }
                return pasos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando tracking");
                return new List<TrackingPasoDto>();
            }
        }

        public async Task CambiarEstadoAsync(long idPedido, string codigoEstado, long idUsuarioActor, string? comentario)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_PEDIDO.SP_CAMBIAR_ESTADO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
            command.Parameters.Add("P_CODIGO_ESTADO", OracleDbType.Varchar2).Value = codigoEstado;
            command.Parameters.Add("P_ID_USUARIO_ACTOR", OracleDbType.Int64).Value = idUsuarioActor;
            command.Parameters.Add("P_COMENTARIO", OracleDbType.Varchar2).Value = (object?)comentario ?? DBNull.Value;
            command.Parameters.Add("P_DIRECCION_IP", OracleDbType.Varchar2).Value = DBNull.Value;

            await command.ExecuteNonQueryAsync();
        }
    }
}
