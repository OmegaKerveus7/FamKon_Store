using FamKon_store_api.Models;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Text;
using System.Text.Json;
using FamKon_store_api.Models.DTOs;

namespace FamKon_store_api.Data
{
    public class UsuarioRepository : IUsuarioRepository
    {
        private readonly string _connectionString;
        private readonly ILogger<UsuarioRepository> _logger;

        public UsuarioRepository(IConfiguration configuration, ILogger<UsuarioRepository> logger)
        {
            _connectionString = configuration.GetConnectionString("Oracle") ?? string.Empty;
            _logger = logger;
        }

        public async Task<LoginResult> LoginPorCredencialesAsync(string? correo, string? nickname, string contrasena)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                var usuarioOCorreo = !string.IsNullOrWhiteSpace(correo) ? correo : nickname ?? string.Empty;

                using var command = new OracleCommand(
                    "SELECT ID_USUARIO, NOMBRES, APELLIDOS, CORREO, NICKNAME, CODIGO_QR, ROLE, FOTO_O, FOTO_E, FECHA_NACAIMIENTO " +
                    "FROM USUARIOS WHERE (UPPER(CORREO) = UPPER(:id) OR UPPER(NICKNAME) = UPPER(:id2)) " +
                    "AND \"CONTRASEÑA\" = :pwd", connection);

                command.Parameters.Add(":id", OracleDbType.Varchar2).Value = usuarioOCorreo;
                command.Parameters.Add(":id2", OracleDbType.Varchar2).Value = usuarioOCorreo;
                command.Parameters.Add(":pwd", OracleDbType.Varchar2).Value = contrasena;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var usuario = MapReaderToUsuario(reader);
                    return new LoginResult { CodigoS = 200, Mensaje = "Login exitoso.", Usuario = usuario };
                }

                return new LoginResult { CodigoS = 404, Mensaje = "Usuario o contraseña incorrectos.", Usuario = null };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en login por credenciales");
                return new LoginResult { CodigoS = 500, Mensaje = "Error al conectar con la base de datos.", Usuario = null };
            }
        }

        public async Task<LoginResult> LoginPorQrAsync(string codigoQr)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(
                    "SELECT ID_USUARIO, NOMBRES, APELLIDOS, CORREO, NICKNAME, CODIGO_QR, ROLE, FOTO_O, FOTO_E, FECHA_NACAIMIENTO " +
                    "FROM USUARIOS WHERE CODIGO_QR = :qr", connection);

                command.Parameters.Add(":qr", OracleDbType.Char).Value = codigoQr;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var usuario = MapReaderToUsuario(reader);
                    return new LoginResult { CodigoS = 200, Mensaje = "Login por QR exitoso.", Usuario = usuario };
                }

                return new LoginResult { CodigoS = 404, Mensaje = "Código QR no encontrado.", Usuario = null };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en login por QR");
                return new LoginResult { CodigoS = 500, Mensaje = "Error al conectar con la base de datos.", Usuario = null };
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
                    return MapReaderToUsuario(reader);

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo usuario por ID {Id}", idUsuario);
                return null;
            }
        }

        public async Task<Usuario?> ObtenerPorIdentificacionAsync(string identificacion)
        {
            if (int.TryParse(identificacion, out var id))
                return await ObtenerPorIdAsync(id);

            return await ObtenerPorCorreoONicknameAsync(identificacion);
        }

        public async Task<Usuario?> ObtenerPorCorreoONicknameAsync(string correoONickname)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(
                    "SELECT ID_USUARIO, NOMBRES, APELLIDOS, CORREO, NICKNAME, CODIGO_QR, ROLE, FOTO_O, FOTO_E, FECHA_NACAIMIENTO " +
                    "FROM USUARIOS WHERE UPPER(CORREO) = UPPER(:ident) OR UPPER(NICKNAME) = UPPER(:ident2)", connection);

                command.Parameters.Add(":ident", OracleDbType.Varchar2).Value = correoONickname;
                command.Parameters.Add(":ident2", OracleDbType.Varchar2).Value = correoONickname;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                    return MapReaderToUsuario(reader);

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo usuario por identificación {Ident}", correoONickname);
                return null;
            }
        }

        public async Task<bool> ActualizarFotoAsync(int idUsuario, string fotoOriginalBase64)
        {
            try
            {
                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(
                    "UPDATE USUARIOS SET FOTO_O = :foto WHERE ID_USUARIO = :id", connection);
                // Decodificar base64 y escribir bytes en BLOB
                var fotoBytes = Convert.FromBase64String(fotoOriginalBase64);
                using var blob = new OracleBlob(connection);
                blob.Write(fotoBytes, 0, fotoBytes.Length);

                _logger.LogInformation("ActualizarFotoAsync: foto chars={Length} bytes={Bytes} blobLength={BlobLength}",
                    fotoOriginalBase64.Length, fotoBytes.Length, blob.Length);

                command.Parameters.Add(":foto", OracleDbType.Blob).Value = blob;
                command.Parameters.Add(":id", OracleDbType.Decimal).Value = idUsuario;

                var rows = await command.ExecuteNonQueryAsync();
                return rows > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar foto del usuario {IdUsuario}", idUsuario);
                return false;
            }
        }

        public async Task<RegistroResult> RegistrarCompradorAsync(RegistroRequest request)
        {
            try
            {
                var codigoQr = GenerarCodigoQr();
                var nickname = request.Nickname.Trim();
                var fotoO = request.FotoOriginalBase64;
                var fotoE = string.IsNullOrWhiteSpace(request.FotoEditadaBase64)
                    ? request.FotoOriginalBase64
                    : request.FotoEditadaBase64;

                using var connection = new OracleConnection(_connectionString);
                await connection.OpenAsync();

                using var command = new OracleCommand(@"
                    INSERT INTO USUARIOS (ROLES_ID_rol, CODIGO_QR, NOMBRES, APELLIDOS, CORREO, CONTRASEÑA, FOTO_O, FOTO_E, FECHA_NACAIMIENTO, NICKNAME)
                    VALUES (4, :qr, :nombres, :apellidos, :correo, :contrasena, :fotoO, :fotoE, :fecha, :nickname)
                    RETURNING ID_USUARIO INTO :id_out", connection);

                command.Parameters.Add(":qr", OracleDbType.Char).Value = codigoQr;
                command.Parameters.Add(":nombres", OracleDbType.Varchar2).Value = request.Nombres.Trim();
                command.Parameters.Add(":apellidos", OracleDbType.Varchar2).Value = request.Apellidos.Trim();
                command.Parameters.Add(":correo", OracleDbType.Varchar2).Value = request.Correo.Trim();
                command.Parameters.Add(":contrasena", OracleDbType.Varchar2).Value = request.Contrasena;
                command.Parameters.Add(":fecha", OracleDbType.Date).Value = request.FechaNacimiento;
                command.Parameters.Add(":nickname", OracleDbType.Varchar2).Value = nickname;

                // Decodificar base64 y escribir en BLOBs
                var fotoOBytes = Convert.FromBase64String(fotoO);
                using var blobO = new OracleBlob(connection);
                blobO.Write(fotoOBytes, 0, fotoOBytes.Length);
                command.Parameters.Add(":fotoO", OracleDbType.Blob).Value = blobO;

                var fotoEBytes = Convert.FromBase64String(fotoE);
                using var blobE = new OracleBlob(connection);
                blobE.Write(fotoEBytes, 0, fotoEBytes.Length);
                command.Parameters.Add(":fotoE", OracleDbType.Blob).Value = blobE;

                var idParam = command.Parameters.Add(":id_out", OracleDbType.Decimal);
                idParam.Direction = ParameterDirection.Output;

                await command.ExecuteNonQueryAsync();

                var idUsuario = Convert.ToInt32(((OracleDecimal)idParam.Value).Value);

                return new RegistroResult
                {
                    CodigoS = 200,
                    Mensaje = "Registro exitoso.",
                    Data = new RegistroData
                    {
                        IdUsuario = idUsuario,
                        Nickname = nickname,
                        CodigoQr = codigoQr
                    }
                };
            }
            catch (OracleException ex) when (ex.Number == 1) // Unique constraint violation
            {
                return new RegistroResult { CodigoS = 409, Mensaje = "El correo o nickname ya existe.", Data = null };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al registrar comprador con nickname {Nickname}", request.Nickname);
                return new RegistroResult { CodigoS = 500, Mensaje = "No fue posible registrar al comprador.", Data = null };
            }
        }

        private static Usuario MapReaderToUsuario(OracleDataReader reader)
        {
            var usuario = new Usuario
            {
                Id = reader.GetInt32(0),
                Nombres = reader.GetString(1),
                Apellidos = reader.GetString(2),
                Correo = reader.IsDBNull(3) ? null : reader.GetString(3),
                Nickname = reader.IsDBNull(4) ? null : reader.GetString(4),
                CodigoQr = reader.IsDBNull(5) ? null : reader.GetString(5),
                Role = reader.GetInt32(6),
            };

            // Leer BLOB FOTO_O (columna 7) y convertir a base64
            if (!reader.IsDBNull(7))
            {
                using var oracleBlob = reader.GetOracleBlob(7);
                if (oracleBlob != null && !oracleBlob.IsNull)
                    usuario.FotoOriginal = Convert.ToBase64String(oracleBlob.Value);
            }

            // Leer BLOB FOTO_E (columna 8) y convertir a base64
            if (!reader.IsDBNull(8))
            {
                using var oracleBlob = reader.GetOracleBlob(8);
                if (oracleBlob != null && !oracleBlob.IsNull)
                    usuario.FotoEditada = Convert.ToBase64String(oracleBlob.Value);
            }

            // Fecha nacimiento (columna 9)
            if (!reader.IsDBNull(9))
                usuario.FechaNacimiento = reader.GetDateTime(9);

            return usuario;
        }

        private static string GenerarCodigoQr()
        {
            return "QR" + Random.Shared.Next(100000, 999999).ToString();
        }
    }
}
