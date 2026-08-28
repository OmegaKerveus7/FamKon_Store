using FamKon_store_api.Models;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Text.Json;
using FamKon_store_api.Models.DTOs;

namespace FamKon_store_api.Data
{
    public class UsuarioRepository : IUsuarioRepository
    {
        private readonly string _connectionString;
        private readonly ILogger<UsuarioRepository> _logger;

        public UsuarioRepository(
       IConfiguration configuration,
       ILogger<UsuarioRepository> logger)
        {
            _connectionString =
                configuration.GetConnectionString("Oracle")
                ?? string.Empty;

            _logger = logger;
        }

        public async Task<LoginResult> LoginPorCredencialesAsync(string? correo, string? nickname, string contrasena)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand("PKG_LOGIN.LOGIN_BY_CREDENTIALS", connection);
                command.CommandType = CommandType.StoredProcedure;

                var usuarioOCorreo = !string.IsNullOrWhiteSpace(correo) ? correo : nickname ?? string.Empty;

                command.Parameters.Add("p_usuario_o_correo", OracleDbType.Varchar2).Value = usuarioOCorreo;
                command.Parameters.Add("p_contraseña", OracleDbType.Varchar2).Value = contrasena;
                command.Parameters.Add("p_codigo_s", OracleDbType.Decimal).Direction = ParameterDirection.Output;
                command.Parameters.Add("p_mensaje", OracleDbType.NVarchar2, 500).Direction = ParameterDirection.Output;
                command.Parameters.Add("p_data", OracleDbType.NVarchar2, 4000).Direction = ParameterDirection.Output;

                await command.ExecuteNonQueryAsync();

                var codigoS = Convert.ToInt32(((OracleDecimal)command.Parameters["p_codigo_s"].Value).Value);
                var mensaje = command.Parameters["p_mensaje"].Value?.ToString() ?? string.Empty;
                var data = command.Parameters["p_data"].Value?.ToString();

                if (codigoS != 200 || string.IsNullOrEmpty(data))
                {
                    return new LoginResult { CodigoS = codigoS, Mensaje = mensaje, Usuario = null };
                }

                var usuario = ParsearUsuario(data);
                return new LoginResult { CodigoS = codigoS, Mensaje = mensaje, Usuario = usuario };
            }
            catch (Exception ex)
            {
                return new LoginResult
                {
                    CodigoS = 500,
                    Mensaje = "Error al conectar con la base de datos: " + ex.Message,
                    Usuario = null
                };
            }
        }

        public async Task<LoginResult> LoginPorQrAsync(string codigoQr)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand("PKG_LOGIN.LOGIN_BY_QR", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("p_codigo_qr", OracleDbType.Char).Value = codigoQr;
                command.Parameters.Add("p_codigo_s", OracleDbType.Decimal).Direction = ParameterDirection.Output;
                command.Parameters.Add("p_mensaje", OracleDbType.NVarchar2, 500).Direction = ParameterDirection.Output;
                command.Parameters.Add("p_data", OracleDbType.NVarchar2, 4000).Direction = ParameterDirection.Output;

                await command.ExecuteNonQueryAsync();

                var codigoS = Convert.ToInt32(((OracleDecimal)command.Parameters["p_codigo_s"].Value).Value);
                var mensaje = command.Parameters["p_mensaje"].Value?.ToString() ?? string.Empty;
                var data = command.Parameters["p_data"].Value?.ToString();

                if (codigoS != 200 || string.IsNullOrEmpty(data))
                {
                    return new LoginResult { CodigoS = codigoS, Mensaje = mensaje, Usuario = null };
                }

                var usuario = ParsearUsuario(data);
                return new LoginResult { CodigoS = codigoS, Mensaje = mensaje, Usuario = usuario };
            }
            catch (Exception ex)
            {
                return new LoginResult
                {
                    CodigoS = 500,
                    Mensaje = "Error al conectar con la base de datos: " + ex.Message,
                    Usuario = null
                };
            }
        }

        public async Task<Usuario?> ObtenerPorIdAsync(int idUsuario)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(
                    "SELECT ID_USUARIO, NOMBRES, APELLIDOS, CORREO, NICKNAME, CODIGO_QR, ROLE, FOTO_O, FOTO_E, FECHA_NACAIMIENTO " +
                    "FROM USUARIOS WHERE ID_USUARIO = :id", connection);

                command.Parameters.Add(":id", OracleDbType.Decimal).Value = idUsuario;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new Usuario
                    {
                        Id = reader.GetInt32(0),
                        Nombres = reader.GetString(1),
                        Apellidos = reader.GetString(2),
                        Correo = reader.IsDBNull(3) ? null : reader.GetString(3),
                        Nickname = reader.IsDBNull(4) ? null : reader.GetString(4),
                        CodigoQr = reader.IsDBNull(5) ? null : reader.GetString(5),
                        Role = reader.GetInt32(6),
                        FotoOriginal = reader.IsDBNull(7) ? null : reader.GetString(7),
                        FotoEditada = reader.IsDBNull(8) ? null : reader.GetString(8),
                        FechaNacimiento = reader.IsDBNull(9) ? null : reader.GetDateTime(9)
                    };
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        public async Task<Usuario?> ObtenerPorIdentificacionAsync(string identificacion)
        {
            if (int.TryParse(identificacion, out var id))
                return await ObtenerPorIdAsync(id);

            var result = await LoginPorCredencialesAsync(identificacion, identificacion, "");
            return result.CodigoS == 200 ? result.Usuario : null;
        }
        public async Task<RegistroResult> RegistrarCompradorAsync(
    RegistroRequest request)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(
                    "PKG_USUARIOS.CRUD",
                    connection);

                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                // Valores controlados por el backend
                command.Parameters.Add(
                    "p_id_usuario",
                    OracleDbType.Decimal).Value = DBNull.Value;

                command.Parameters.Add(
                    "p_role",
                    OracleDbType.Decimal).Value = 4;

                command.Parameters.Add(
                    "p_codigo_qr",
                    OracleDbType.Char).Value = DBNull.Value;

                // Valores enviados por el comprador
                command.Parameters.Add(
                    "p_nombres",
                    OracleDbType.Varchar2).Value = request.Nombres.Trim();

                command.Parameters.Add(
                    "p_apellidos",
                    OracleDbType.Varchar2).Value = request.Apellidos.Trim();

                command.Parameters.Add(
                    "p_correo",
                    OracleDbType.Varchar2).Value = request.Correo.Trim();

                command.Parameters.Add(
                    "p_contraseña",
                    OracleDbType.Varchar2).Value = request.Contrasena;

                command.Parameters.Add(
                    "p_foto_o",
                    OracleDbType.Clob).Value = request.FotoOriginalBase64;

                command.Parameters.Add(
                    "p_foto_e",
                    OracleDbType.Clob).Value =
                        string.IsNullOrWhiteSpace(request.FotoEditadaBase64)
                            ? request.FotoOriginalBase64
                            : request.FotoEditadaBase64;

                command.Parameters.Add(
                    "p_fecha_nacimiento",
                    OracleDbType.Date).Value = request.FechaNacimiento;

                command.Parameters.Add(
                    "p_nickname",
                    OracleDbType.Varchar2).Value = request.Nickname.Trim();

                // Usuario responsable de la operación
                command.Parameters.Add(
                    "p_usuario",
                    OracleDbType.NVarchar2).Value = "REGISTRO_PUBLICO";

                // Parámetros de salida
                command.Parameters.Add(
                    "p_codigo_s",
                    OracleDbType.Decimal).Direction = ParameterDirection.Output;

                command.Parameters.Add(
                    "p_mensaje",
                    OracleDbType.NVarchar2,
                    500).Direction = ParameterDirection.Output;

                command.Parameters.Add(
                    "p_data",
                    OracleDbType.NVarchar2,
                    4000).Direction = ParameterDirection.Output;

                // Indica al CRUD que debe crear
                command.Parameters.Add(
                    "p_opcion",
                    OracleDbType.NVarchar2).Value = "C";

                await command.ExecuteNonQueryAsync();

                var codigo = Convert.ToInt32(
                    ((OracleDecimal)command.Parameters["p_codigo_s"].Value).Value);

                var mensaje =
                    command.Parameters["p_mensaje"].Value?.ToString()
                    ?? string.Empty;

                var dataValue = command.Parameters["p_data"].Value;

                string? json = null;

                if (dataValue is OracleString oracleString)
                {
                    if (!oracleString.IsNull)
                    {
                        json = oracleString.Value;
                    }
                }
                else if (dataValue is not null && dataValue != DBNull.Value)
                {
                    json = dataValue.ToString();
                }

                RegistroData? data = null;

                // Solo existe información del usuario cuando el SP respondió exitosamente.
                if (codigo == 200 && !string.IsNullOrWhiteSpace(json))
                {
                    using var document = JsonDocument.Parse(json);
                    var root = document.RootElement;

                    data = new RegistroData
                    {
                        IdUsuario = root.GetProperty("id_usuario").GetInt32(),

                        Nickname = root.GetProperty("nickname").GetString()
                            ?? string.Empty,

                        CodigoQr = root.GetProperty("codigo_qr").GetString()
                            ?? string.Empty
                    };
                }

                return new RegistroResult
                {
                    CodigoS = codigo,
                    Mensaje = mensaje,
                    Data = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error al registrar al comprador con nickname {Nickname}",
                    request.Nickname);

                return new RegistroResult
                {
                    CodigoS = 500,
                    Mensaje = "No fue posible registrar al comprador.",
                    Data = null
                };
            }
        }
        private static Usuario ParsearUsuario(string jsonData)
        {
            using var doc = JsonDocument.Parse(jsonData);
            var root = doc.RootElement;

            var usuario = new Usuario();

            if (root.TryGetProperty("id_usuario", out var id))
                usuario.Id = id.GetInt32();

            if (root.TryGetProperty("nombres", out var nombres))
                usuario.Nombres = nombres.GetString() ?? string.Empty;

            if (root.TryGetProperty("apellidos", out var apellidos))
                usuario.Apellidos = apellidos.GetString() ?? string.Empty;

            if (root.TryGetProperty("correo", out var correo))
                usuario.Correo = correo.GetString();

            if (root.TryGetProperty("nickname", out var nickname))
                usuario.Nickname = nickname.GetString();

            if (root.TryGetProperty("codigo_qr", out var codigoQr))
                usuario.CodigoQr = codigoQr.GetString();

            if (root.TryGetProperty("role", out var role))
                usuario.Role = role.GetInt32();

            if (root.TryGetProperty("foto_o", out var fotoO))
                usuario.FotoOriginal = fotoO.GetString();

            if (root.TryGetProperty("foto_e", out var fotoE))
                usuario.FotoEditada = fotoE.GetString();

            if (root.TryGetProperty("fecha_nacimiento", out var fechaNac) && fechaNac.ValueKind != JsonValueKind.Null)
                usuario.FechaNacimiento = fechaNac.GetDateTime();

            return usuario;
        }
    }
}
