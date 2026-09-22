using System.Data;
using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace FamKon_store_api.Services
{
    public class EntregaRepartidor
    {
        public long IdEntrega { get; set; }
        public long IdPedido { get; set; }
        public string NumeroPedido { get; set; } = string.Empty;
        public int NumeroIntento { get; set; }
        public string CodigoEstado { get; set; } = string.Empty;
        public string EstadoEntrega { get; set; } = string.Empty;
        public string AreaEntrega { get; set; } = string.Empty;
        public string? Referencia { get; set; }
        public DateTime? FechaAsignacion { get; set; }
        public DateTime? FechaIntento { get; set; }
        public DateTime? FechaEntrega { get; set; }
        public decimal MontoEfectivo { get; set; }
        public string? Observaciones { get; set; }
        public long? IdArchivoEvidencia { get; set; }
    }

    public class EntregaTracking
    {
        public long IdEntrega { get; set; }
        public long IdPedido { get; set; }
        public long IdRepartidor { get; set; }
        public string? RepartidorNickname { get; set; }
        public string NumeroPedido { get; set; } = string.Empty;
        public int NumeroIntento { get; set; }
        public string CodigoEstado { get; set; } = string.Empty;
        public string EstadoEntrega { get; set; } = string.Empty;
        public string AreaEntrega { get; set; } = string.Empty;
        public string? Referencia { get; set; }
        public DateTime? FechaAsignacion { get; set; }
        public DateTime? FechaIntento { get; set; }
        public DateTime? FechaEntrega { get; set; }
        public decimal MontoEfectivo { get; set; }
        public string? Observaciones { get; set; }
        public long? IdArchivoEvidencia { get; set; }
        public string EstadoPedido { get; set; } = string.Empty;
        public string EstadoPedidoNombre { get; set; } = string.Empty;
        public decimal PedidoTotal { get; set; }
    }

    public class PedidoParaEntrega
    {
        public long IdPedido { get; set; }
        public string NumeroPedido { get; set; } = string.Empty;
        public string EstadoPedido { get; set; } = string.Empty;
        public string AreaEntrega { get; set; } = string.Empty;
        public string? Referencia { get; set; }
        public decimal Total { get; set; }
        public DateTime FechaPedido { get; set; }
    }

    public class OperacionResult
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public long? Id { get; set; }
    }

    public class RepartidorService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<RepartidorService> _logger;

        public RepartidorService(DBContext dbContext, ILogger<RepartidorService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<List<EntregaRepartidor>> ListarEntregasAsync(long idRepartidor)
        {
            var lista = new List<EntregaRepartidor>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(
                    "PKG_PAGO_ENTREGA.SP_LISTAR_ENTREGAS_REPARTIDOR", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_REPARTIDOR", OracleDbType.Int64).Value = idRepartidor;
                var oDatos = new OracleParameter("O_DATOS", OracleDbType.RefCursor)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oDatos);

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(MapEntrega(reader));
                }
                _logger.LogInformation(
                    "SP_LISTAR_ENTREGAS_REPARTIDOR repartidor={Id} total={Total}",
                    idRepartidor, lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error ejecutando PKG_PAGO_ENTREGA.SP_LISTAR_ENTREGAS_REPARTIDOR id={Id}",
                    idRepartidor);
            }
            return lista;
        }

        public async Task<List<EntregaTracking>> ListarTodasLasEntregasAsync(string? filtroEstado = null)
        {
            var lista = new List<EntregaTracking>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                const string sql = @"
                    SELECT E.ID_ENTREGA, E.ID_PEDIDO, P.NUMERO_PEDIDO, E.NUMERO_INTENTO,
                           EE.CODIGO AS CODIGO_ESTADO, EE.NOMBRE AS ESTADO_ENTREGA,
                           AE.NOMBRE AS AREA_ENTREGA, AE.REFERENCIA,
                           E.FECHA_ASIGNACION, E.FECHA_INTENTO, E.FECHA_ENTREGA,
                           E.MONTO_EFECTIVO, E.OBSERVACIONES, E.ID_ARCHIVO_EVIDENCIA,
                           E.ID_REPARTIDOR, U.NICKNAME AS REPARTIDOR_NICKNAME,
                           EP.CODIGO AS ESTADO_PEDIDO, EP.NOMBRE AS ESTADO_PEDIDO_NOMBRE,
                           P.TOTAL AS PEDIDO_TOTAL
                      FROM ENTREGA E
                      JOIN PEDIDO P           ON P.ID_PEDIDO = E.ID_PEDIDO
                      JOIN ESTADO_ENTREGA EE  ON EE.ID_ESTADO_ENTREGA = E.ID_ESTADO_ENTREGA
                      JOIN AREA_ENTREGA AE   ON AE.ID_AREA_ENTREGA = E.ID_AREA_ENTREGA
                      JOIN ESTADO_PEDIDO EP  ON EP.ID_ESTADO_PEDIDO = P.ID_ESTADO_PEDIDO
                      LEFT JOIN USUARIO U    ON U.ID_USUARIO = E.ID_REPARTIDOR
                     WHERE (:filtro IS NULL OR EE.CODIGO = :filtro)
                     ORDER BY E.FECHA_ASIGNACION DESC, E.ID_ENTREGA DESC";

                using var command = new OracleCommand(sql, connection);
                command.CommandType = CommandType.Text;
                command.Parameters.Add("filtro", OracleDbType.Varchar2).Value =
                    (object?)filtroEstado ?? DBNull.Value;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new EntregaTracking
                    {
                        IdEntrega = reader.GetInt64(reader.GetOrdinal("ID_ENTREGA")),
                        IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                        NumeroPedido = reader.GetString(reader.GetOrdinal("NUMERO_PEDIDO")),
                        NumeroIntento = reader.GetInt32(reader.GetOrdinal("NUMERO_INTENTO")),
                        CodigoEstado = reader.GetString(reader.GetOrdinal("CODIGO_ESTADO")),
                        EstadoEntrega = reader.GetString(reader.GetOrdinal("ESTADO_ENTREGA")),
                        AreaEntrega = reader.GetString(reader.GetOrdinal("AREA_ENTREGA")),
                        MontoEfectivo = reader.GetDecimal(reader.GetOrdinal("MONTO_EFECTIVO")),
                        EstadoPedido = reader.GetString(reader.GetOrdinal("ESTADO_PEDIDO")),
                        EstadoPedidoNombre = reader.GetString(reader.GetOrdinal("ESTADO_PEDIDO_NOMBRE")),
                        PedidoTotal = reader.GetDecimal(reader.GetOrdinal("PEDIDO_TOTAL")),
                        IdRepartidor = reader.GetInt64(reader.GetOrdinal("ID_REPARTIDOR")),
                    });
                    var ordRef = reader.GetOrdinal("REFERENCIA");
                    if (!reader.IsDBNull(ordRef))
                        lista[^1].Referencia = reader.GetString(ordRef);

                    var ordFa = reader.GetOrdinal("FECHA_ASIGNACION");
                    if (!reader.IsDBNull(ordFa))
                        lista[^1].FechaAsignacion = reader.GetDateTime(ordFa);

                    var ordFi = reader.GetOrdinal("FECHA_INTENTO");
                    if (!reader.IsDBNull(ordFi))
                        lista[^1].FechaIntento = reader.GetDateTime(ordFi);

                    var ordFe = reader.GetOrdinal("FECHA_ENTREGA");
                    if (!reader.IsDBNull(ordFe))
                        lista[^1].FechaEntrega = reader.GetDateTime(ordFe);

                    var ordObs = reader.GetOrdinal("OBSERVACIONES");
                    if (!reader.IsDBNull(ordObs))
                        lista[^1].Observaciones = reader.GetString(ordObs);

                    var ordArc = reader.GetOrdinal("ID_ARCHIVO_EVIDENCIA");
                    if (!reader.IsDBNull(ordArc))
                        lista[^1].IdArchivoEvidencia = reader.GetInt64(ordArc);

                    var ordRep = reader.GetOrdinal("REPARTIDOR_NICKNAME");
                    if (!reader.IsDBNull(ordRep))
                        lista[^1].RepartidorNickname = reader.GetString(ordRep);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando todas las entregas");
            }
            return lista;
        }

        // Pedidos que ya estan LISTO_ENTREGA y sin entrega activa
        public async Task<List<PedidoParaEntrega>> ListarPedidosParaEntregaAsync()
        {
            var lista = new List<PedidoParaEntrega>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                const string sql = @"
                    SELECT P.ID_PEDIDO, P.NUMERO_PEDIDO, EP.CODIGO AS ESTADO_PEDIDO,
                           AE.NOMBRE AS AREA_ENTREGA, AE.REFERENCIA,
                           P.TOTAL, P.FECHA_PEDIDO
                      FROM PEDIDO P
                      JOIN ESTADO_PEDIDO EP ON EP.ID_ESTADO_PEDIDO = P.ID_ESTADO_PEDIDO
                      JOIN AREA_ENTREGA AE  ON AE.ID_AREA_ENTREGA  = P.ID_AREA_ENTREGA
                     WHERE EP.CODIGO = 'LISTO_ENTREGA'
                       AND NOT EXISTS (
                           SELECT 1
                             FROM ENTREGA E
                             JOIN ESTADO_ENTREGA EE ON EE.ID_ESTADO_ENTREGA = E.ID_ESTADO_ENTREGA
                            WHERE E.ID_PEDIDO = P.ID_PEDIDO
                              AND EE.ES_FINAL = 'N'
                       )
                     ORDER BY P.FECHA_PEDIDO";

                using var command = new OracleCommand(sql, connection);
                command.CommandType = CommandType.Text;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new PedidoParaEntrega
                    {
                        IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                        NumeroPedido = reader.GetString(reader.GetOrdinal("NUMERO_PEDIDO")),
                        EstadoPedido = reader.GetString(reader.GetOrdinal("ESTADO_PEDIDO")),
                        AreaEntrega = reader.GetString(reader.GetOrdinal("AREA_ENTREGA")),
                        Total = reader.GetDecimal(reader.GetOrdinal("TOTAL")),
                        FechaPedido = reader.GetDateTime(reader.GetOrdinal("FECHA_PEDIDO")),
                    });
                    var ordRef = reader.GetOrdinal("REFERENCIA");
                    if (!reader.IsDBNull(ordRef))
                        lista[^1].Referencia = reader.GetString(ordRef);
                }
                _logger.LogInformation("PedidosParaEntrega total={Total}", lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando pedidos para entrega");
            }
            return lista;
        }

        public async Task<OperacionResult> AsignarEntregaAsync(long idPedido, long idRepartidor)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(
                    "PKG_PAGO_ENTREGA.SP_ASIGNAR_ENTREGA", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
                command.Parameters.Add("P_ID_REPARTIDOR", OracleDbType.Int64).Value = idRepartidor;

                var oIdEntrega = new OracleParameter("O_ID_ENTREGA", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oIdEntrega);

                await command.ExecuteNonQueryAsync();

                long idEntrega = oIdEntrega.Value != null && oIdEntrega.Value != DBNull.Value
                    ? ((OracleDecimal)oIdEntrega.Value).ToInt64()
                    : 0;

                _logger.LogInformation(
                    "SP_ASIGNAR_ENTREGA pedido={Ped} repartidor={Rep} idEntrega={Ent}",
                    idPedido, idRepartidor, idEntrega);

                return new OperacionResult
                {
                    CodigoS = 200,
                    Mensaje = "Entrega asignada correctamente.",
                    Id = idEntrega
                };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex,
                    "SP_ASIGNAR_ENTREGA error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20607 => 400,
                    -20608 => 404,
                    _ => 500
                };
                return new OperacionResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "")
                        .TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' ')
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando SP_ASIGNAR_ENTREGA");
                return new OperacionResult { CodigoS = 500, Mensaje = "Error interno." };
            }
        }

        private static EntregaRepartidor MapEntrega(OracleDataReader reader)
        {
            var row = new EntregaRepartidor
            {
                IdEntrega = reader.GetInt64(reader.GetOrdinal("ID_ENTREGA")),
                IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                NumeroPedido = reader.GetString(reader.GetOrdinal("NUMERO_PEDIDO")),
                NumeroIntento = reader.GetInt32(reader.GetOrdinal("NUMERO_INTENTO")),
                CodigoEstado = reader.GetString(reader.GetOrdinal("CODIGO_ESTADO")),
                EstadoEntrega = reader.GetString(reader.GetOrdinal("ESTADO_ENTREGA")),
                AreaEntrega = reader.GetString(reader.GetOrdinal("AREA_ENTREGA")),
                MontoEfectivo = reader.IsDBNull(reader.GetOrdinal("MONTO_EFECTIVO"))
                    ? 0 : reader.GetDecimal(reader.GetOrdinal("MONTO_EFECTIVO")),
                Observaciones = reader.IsDBNull(reader.GetOrdinal("OBSERVACIONES"))
                    ? null : reader.GetString(reader.GetOrdinal("OBSERVACIONES")),
                IdArchivoEvidencia = reader.IsDBNull(reader.GetOrdinal("ID_ARCHIVO_EVIDENCIA"))
                    ? null : reader.GetInt64(reader.GetOrdinal("ID_ARCHIVO_EVIDENCIA")),
            };
            var ordRef = reader.GetOrdinal("REFERENCIA");
            if (!reader.IsDBNull(ordRef))
                row.Referencia = reader.GetString(ordRef);

            var ordFa = reader.GetOrdinal("FECHA_ASIGNACION");
            if (!reader.IsDBNull(ordFa))
                row.FechaAsignacion = reader.GetDateTime(ordFa);

            var ordFi = reader.GetOrdinal("FECHA_INTENTO");
            if (!reader.IsDBNull(ordFi))
                row.FechaIntento = reader.GetDateTime(ordFi);

            var ordFe = reader.GetOrdinal("FECHA_ENTREGA");
            if (!reader.IsDBNull(ordFe))
                row.FechaEntrega = reader.GetDateTime(ordFe);

            return row;
        }

        public async Task<OperacionResult> CambiarEstadoPedidoAsync(
            long idPedido, string codigoEstado, long idUsuarioActor,
            string? comentario = null)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(
                    "PKG_PEDIDO.SP_CAMBIAR_ESTADO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
                command.Parameters.Add("P_CODIGO_ESTADO", OracleDbType.Varchar2).Value = codigoEstado;
                command.Parameters.Add("P_ID_USUARIO_ACTOR", OracleDbType.Int64).Value = idUsuarioActor;
                command.Parameters.Add("P_COMENTARIO", OracleDbType.NVarchar2).Value =
                    (object?)comentario ?? DBNull.Value;
                command.Parameters.Add("P_DIRECCION_IP", OracleDbType.Varchar2).Value = DBNull.Value;

                await command.ExecuteNonQueryAsync();

                _logger.LogInformation(
                    "SP_CAMBIAR_ESTADO pedido={Ped} estado={Est} actor={Actor}",
                    idPedido, codigoEstado, idUsuarioActor);

                return new OperacionResult
                {
                    CodigoS = 200,
                    Mensaje = $"Estado cambiado a {codigoEstado}."
                };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex,
                    "SP_CAMBIAR_ESTADO error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20505 => 400,
                    -20506 => 404,
                    _ => 500
                };
                return new OperacionResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "")
                        .TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' ')
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando SP_CAMBIAR_ESTADO");
                return new OperacionResult { CodigoS = 500, Mensaje = "Error interno." };
            }
        }

        public async Task<OperacionResult> RegistrarResultadoEntregaAsync(
            long idEntrega, string codigoEstado, long idUsuarioActor,
            decimal montoEfectivo = 0, string? observaciones = null,
            long? idArchivoEvidencia = null)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(
                    "PKG_PAGO_ENTREGA.SP_REGISTRAR_RESULTADO_ENTREGA", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_ENTREGA", OracleDbType.Int64).Value = idEntrega;
                command.Parameters.Add("P_CODIGO_ESTADO", OracleDbType.Varchar2).Value = codigoEstado;
                command.Parameters.Add("P_ID_ARCHIVO_EVIDENCIA", OracleDbType.Int64).Value =
                    (object?)idArchivoEvidencia ?? DBNull.Value;
                command.Parameters.Add("P_MONTO_EFECTIVO", OracleDbType.Decimal).Value = montoEfectivo;
                command.Parameters.Add("P_OBSERVACIONES", OracleDbType.NVarchar2).Value =
                    (object?)observaciones ?? DBNull.Value;
                command.Parameters.Add("P_ID_USUARIO_ACTOR", OracleDbType.Int64).Value = idUsuarioActor;

                await command.ExecuteNonQueryAsync();

                _logger.LogInformation(
                    "SP_REGISTRAR_RESULTADO_ENTREGA entrega={Ent} estado={Est} archivo={Arc} monto={Monto}",
                    idEntrega, codigoEstado, idArchivoEvidencia, montoEfectivo);

                return new OperacionResult
                {
                    CodigoS = 200,
                    Mensaje = codigoEstado switch
                    {
                        "ENTREGADA" => "Entrega registrada como EXITOSA.",
                        "NO_ENCONTRADO" => "Comprador no encontrado. Se intento de nuevo.",
                        "CANCELADA" => "Entrega cancelada.",
                        _ => $"Resultado registrado: {codigoEstado}."
                    }
                };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex,
                    "SP_REGISTRAR_RESULTADO_ENTREGA error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20609 => 404,
                    _ => 500
                };
                return new OperacionResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "")
                        .TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' ')
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando SP_REGISTRAR_RESULTADO_ENTREGA");
                return new OperacionResult { CodigoS = 500, Mensaje = "Error interno." };
            }
        }

        // Lista de repartidores activos para el combo de "Asignar a"
        public async Task<List<RepartidorDisponible>> ListarRepartidoresAsync()
        {
            var lista = new List<RepartidorDisponible>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                const string sql = @"
                    SELECT U.ID_USUARIO, U.NICKNAME, U.CORREO, U.TELEFONO
                      FROM USUARIO U
                      JOIN USUARIO_ROL UR ON UR.ID_USUARIO = U.ID_USUARIO
                      JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                     WHERE U.ACTIVO = 'S' AND U.BLOQUEADO = 'N'
                       AND R.CODIGO = 'REPARTIDOR' AND R.ACTIVO = 'S'
                     ORDER BY U.NICKNAME";

                using var command = new OracleCommand(sql, connection);
                command.CommandType = CommandType.Text;
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new RepartidorDisponible
                    {
                        IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO")),
                        Nickname = reader.GetString(reader.GetOrdinal("NICKNAME")),
                        Correo = reader.GetString(reader.GetOrdinal("CORREO")),
                        Telefono = reader.GetString(reader.GetOrdinal("TELEFONO")),
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando repartidores");
            }
            return lista;
        }
    }

    public class RepartidorDisponible
    {
        public long IdUsuario { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
    }
}
