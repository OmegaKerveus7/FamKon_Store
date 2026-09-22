using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Security.Cryptography;

namespace FamKon_store_api.Services
{
    public class UsuarioResult
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public string? Data { get; set; }
    }

    public class UsuarioService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<UsuarioService> _logger;

        public UsuarioService(DBContext dbContext, ILogger<UsuarioService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<UsuarioResult> CrearUsuarioAsync(
            long idSitio,
            string correo,
            string telefono,
            DateTime? fechaNacimiento,
            string nickname,
            string password,
            string? notificaEmail,
            string? notificaWhatsapp)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_SEGURIDAD.SP_CREAR_USUARIO", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_SITIO", OracleDbType.Int64).Value = idSitio;
                command.Parameters.Add("P_CORREO", OracleDbType.Varchar2).Value = correo;
                command.Parameters.Add("P_TELEFONO", OracleDbType.Varchar2).Value = telefono;
                command.Parameters.Add("P_FECHA_NACIMIENTO", OracleDbType.Date).Value =
                    (object?)fechaNacimiento ?? DBNull.Value;
                command.Parameters.Add("P_NICKNAME", OracleDbType.Varchar2).Value = nickname;
                // El procedimiento recibe hashes de entrada; no devuelve el token QR.
                var tokenQr = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
                command.Parameters.Add("P_PASSWORD_HASH", OracleDbType.Varchar2).Value = LoginService.Sha256LowerHex(password);
                command.Parameters.Add("P_TOKEN_QR_HASH", OracleDbType.Varchar2).Value = LoginService.Sha256LowerHex(tokenQr);
                command.Parameters.Add("P_NOTIFICA_EMAIL", OracleDbType.Char).Value =
                    string.IsNullOrWhiteSpace(notificaEmail) ? "S" : notificaEmail.Trim().ToUpperInvariant();
                command.Parameters.Add("P_NOTIFICA_WHATSAPP", OracleDbType.Char).Value =
                    string.IsNullOrWhiteSpace(notificaWhatsapp) ? "N" : notificaWhatsapp.Trim().ToUpperInvariant();

                var oIdUsuario = new OracleParameter("O_ID_USUARIO", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };

                command.Parameters.Add(oIdUsuario);

                await command.ExecuteNonQueryAsync();

                var idUsuario = ((OracleDecimal)oIdUsuario.Value).ToInt64();

                _logger.LogInformation("PKG_SEGURIDAD.SP_CREAR_USUARIO id={Id} mensaje=Usuario creado",
                    idUsuario);

                return new UsuarioResult
                {
                    CodigoS = 200,
                    Mensaje = "Usuario creado correctamente.",
                    Data = "{\"id_usuario\":" + idUsuario + ",\"token_qr\":\"" + tokenQr + "\"}"
                };
            }
            catch (OracleException ex)
            {
                var codigo = Math.Abs(ex.Number);
                var codigoS = codigo switch
                {
                    20101 => 400,
                    20102 => 400,
                    20103 => 409,
                    20104 => 500,
                    1 => 409,
                    _ => 500
                };
                var mensaje = codigoS == 500
                    ? "Error interno al crear el usuario."
                    : ex.Message.Replace("ORA-20", "").TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' ');

                _logger.LogWarning(ex, "PKG_SEGURIDAD.SP_CREAR_USUARIO oracle error {Codigo}", codigo);

                return new UsuarioResult
                {
                    CodigoS = codigoS,
                    Mensaje = mensaje,
                    Data = null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_SEGURIDAD.SP_CREAR_USUARIO");
                return new UsuarioResult
                {
                    CodigoS = 500,
                    Mensaje = "Error interno al crear el usuario.",
                    Data = null
                };
            }
        }

        public async Task<UsuarioResult> ObtenerUsuarioAsync(long idUsuario)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_USUARIO.MAGNAMETS_USER", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("p_id_usuario", OracleDbType.Int64).Value = idUsuario;
                command.Parameters.Add("p_id_sitio", OracleDbType.Int64).Value = DBNull.Value;
                command.Parameters.Add("p_correo", OracleDbType.Varchar2).Value = DBNull.Value;
                command.Parameters.Add("p_telefono", OracleDbType.Varchar2).Value = DBNull.Value;
                command.Parameters.Add("p_fecha_nacimiento", OracleDbType.Date).Value = DBNull.Value;
                command.Parameters.Add("p_nickname", OracleDbType.Varchar2).Value = DBNull.Value;
                command.Parameters.Add("p_password", OracleDbType.Varchar2).Value = DBNull.Value;
                command.Parameters.Add("p_notifica_email", OracleDbType.Char).Value = DBNull.Value;
                command.Parameters.Add("p_notifica_whatsapp", OracleDbType.Char).Value = DBNull.Value;
                command.Parameters.Add("p_activo", OracleDbType.Char).Value = DBNull.Value;
                command.Parameters.Add("p_bloqueado", OracleDbType.Char).Value = DBNull.Value;
                command.Parameters.Add("p_id_foto_original", OracleDbType.Int64).Value = DBNull.Value;
                command.Parameters.Add("p_id_foto_modificada", OracleDbType.Int64).Value = DBNull.Value;
                command.Parameters.Add("p_id_rol", OracleDbType.Int64).Value = DBNull.Value;
                command.Parameters.Add("p_opcion", OracleDbType.Varchar2).Value = "R";

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

                return new UsuarioResult
                {
                    CodigoS = codigoS,
                    Mensaje = mensaje,
                    Data = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_USUARIO.MAGNAMETS_USER (R)");
                return new UsuarioResult
                {
                    CodigoS = 500,
                    Mensaje = "Error interno al obtener el usuario.",
                    Data = null
                };
            }
        }
    }
}
