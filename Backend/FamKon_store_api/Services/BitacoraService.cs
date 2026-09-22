using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace FamKon_store_api.Services
{
    public class BitacoraService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<BitacoraService> _logger;

        public BitacoraService(DBContext dbContext, ILogger<BitacoraService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<long?> RegistrarAccesoAsync(
            long? idUsuario,
            string identificador,
            string metodoAcceso,
            string resultado,
            string? direccionIp = null,
            string? ubicacion = null,
            string? userAgent = null,
            string? motivo = null)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_SEGURIDAD.SP_REGISTRAR_ACCESO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value =
                    (object?)idUsuario ?? DBNull.Value;
                command.Parameters.Add("P_IDENTIFICADOR", OracleDbType.Varchar2).Value =
                    (object?)identificador ?? DBNull.Value;
                command.Parameters.Add("P_METODO_ACCESO", OracleDbType.Varchar2).Value = metodoAcceso;
                command.Parameters.Add("P_RESULTADO", OracleDbType.Char).Value = resultado;
                command.Parameters.Add("P_DIRECCION_IP", OracleDbType.Varchar2).Value =
                    (object?)direccionIp ?? DBNull.Value;
                command.Parameters.Add("P_UBICACION", OracleDbType.Varchar2).Value =
                    (object?)ubicacion ?? DBNull.Value;
                command.Parameters.Add("P_USER_AGENT", OracleDbType.Varchar2).Value =
                    TruncarUserAgent(userAgent);
                command.Parameters.Add("P_MOTIVO", OracleDbType.Varchar2).Value =
                    (object?)motivo ?? DBNull.Value;

                var oIdBitacora = new OracleParameter("O_ID_BITACORA", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oIdBitacora);

                await command.ExecuteNonQueryAsync();

                long idBitacora = 0;
                if (oIdBitacora.Value != null && oIdBitacora.Value != DBNull.Value)
                    idBitacora = ((OracleDecimal)oIdBitacora.Value).ToInt64();

                _logger.LogInformation(
                    "BITACORA_ACCESO id_bitacora={IdBit} id_usuario={IdUsr} metodo={Metodo} resultado={Res}",
                    idBitacora, idUsuario, metodoAcceso, resultado);

                return idBitacora;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error registrando BITACORA_ACCESO id_usuario={IdUsr} metodo={Metodo}",
                    idUsuario, metodoAcceso);
                return null;
            }
        }

        private static string? TruncarUserAgent(string? ua)
        {
            if (string.IsNullOrEmpty(ua)) return null;
            return ua.Length > 500 ? ua.Substring(0, 500) : ua;
        }
    }
}
