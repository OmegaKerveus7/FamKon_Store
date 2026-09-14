using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace FamKon_store_api.Services
{
    public class LoginResult
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public string? Data { get; set; }
    }

    public class LoginService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<LoginService> _logger;

        public LoginService(DBContext dbContext, ILogger<LoginService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<LoginResult> LoginAsync(
            string? usuarioOCorreo,
            string? nickname,
            string? password,
            string? tokenQr,
            long? idArchivoFoto,
            string opcion)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_LOGIN.CRUD", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("p_usuario_o_correo", OracleDbType.Varchar2).Value =
                    (object?)usuarioOCorreo ?? DBNull.Value;
                command.Parameters.Add("p_nickname", OracleDbType.Varchar2).Value =
                    (object?)nickname ?? DBNull.Value;
                command.Parameters.Add("p_password", OracleDbType.Varchar2).Value =
                    (object?)password ?? DBNull.Value;
                command.Parameters.Add("p_token_qr", OracleDbType.Varchar2).Value =
                    (object?)tokenQr ?? DBNull.Value;
                command.Parameters.Add("p_id_archivo_foto", OracleDbType.Int64).Value =
                    (object?)idArchivoFoto ?? DBNull.Value;
                command.Parameters.Add("p_opcion", OracleDbType.Varchar2).Value = opcion;

                var pCodigoS = new OracleParameter("p_codigo_s", OracleDbType.Int32)
                {
                    Direction = ParameterDirection.Output
                };
                var pMensaje = new OracleParameter("p_mensaje", OracleDbType.NVarchar2, 4000)
                {
                    Direction = ParameterDirection.Output
                };
                var pData = new OracleParameter("p_data", OracleDbType.NVarchar2, 32767)
                {
                    Direction = ParameterDirection.Output
                };

                command.Parameters.Add(pCodigoS);
                command.Parameters.Add(pMensaje);
                command.Parameters.Add(pData);

                await command.ExecuteNonQueryAsync();

                var codigoS = ((OracleDecimal)pCodigoS.Value).ToInt32();
                var mensaje = pMensaje.Value?.ToString() ?? "";
                var data = pData.Value?.ToString();

                _logger.LogInformation("PKG_LOGIN.CRUD opcion={Opcion} codigo={Codigo} mensaje={Mensaje}",
                    opcion, codigoS, mensaje);

                return new LoginResult
                {
                    CodigoS = codigoS,
                    Mensaje = mensaje,
                    Data = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_LOGIN.CRUD");
                return new LoginResult
                {
                    CodigoS = 500,
                    Mensaje = "Error interno al procesar el login.",
                    Data = null
                };
            }
        }
    }
}
