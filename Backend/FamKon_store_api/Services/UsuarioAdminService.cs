using System.Data;
using System.Text.Json;
using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace FamKon_store_api.Services
{
    public class UsuarioAdminRow
    {
        public long IdUsuario { get; set; }
        public long? IdSitio { get; set; }
        public string Correo { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string FechaNacimiento { get; set; } = string.Empty;
        public string Nickname { get; set; } = string.Empty;
        public string Activo { get; set; } = "S";
        public string Bloqueado { get; set; } = "N";
        public string NotificaEmail { get; set; } = "S";
        public string NotificaWhatsapp { get; set; } = "N";
        public int IntentosFallidos { get; set; }
        public DateTime? UltimoAcceso { get; set; }
        public DateTime? FechaCreacion { get; set; }
        public string Roles { get; set; } = string.Empty;
    }

    public class UsuarioGestorRow
    {
        public long IdUsuario { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string FechaNacimiento { get; set; } = string.Empty;
        public int? Edad { get; set; }
        public long? IdSitio { get; set; }
        public string Activo { get; set; } = "S";
        public string Bloqueado { get; set; } = "N";
        public int IntentosFallidos { get; set; }
        public DateTime? UltimoAcceso { get; set; }
        public string NotificaEmail { get; set; } = "S";
        public string NotificaWhatsapp { get; set; } = "N";
        public string Roles { get; set; } = string.Empty;
        public int CantRoles { get; set; }
        public int CantPermisos { get; set; }
        public DateTime? UltimaConexionOk { get; set; }
        public DateTime? UltimaConexionFallida { get; set; }
        public int TotalAccesos { get; set; }
    }

    public class RolRow
    {
        public long IdRol { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string Activo { get; set; } = "S";
    }

    public class UsuarioAdminResult
    {
        public int CodigoS { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public string? Data { get; set; }
    }

    public class CrearUsuarioAdminRequest
    {
        public long IdSitio { get; set; } = 1;
        public string Correo { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public DateTime? FechaNacimiento { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string NotificaEmail { get; set; } = "S";
        public string NotificaWhatsapp { get; set; } = "N";
        public string CodigoRol { get; set; } = "COMPRADOR";
    }

    public class UsuarioAdminService
    {
        private readonly DBContext _dbContext;
        private readonly UsuarioService _usuarioService;
        private readonly ILogger<UsuarioAdminService> _logger;

        public UsuarioAdminService(
            DBContext dbContext,
            UsuarioService usuarioService,
            ILogger<UsuarioAdminService> logger)
        {
            _dbContext = dbContext;
            _usuarioService = usuarioService;
            _logger = logger;
        }

        public async Task<UsuarioAdminResult> CrearUsuarioAsync(CrearUsuarioAdminRequest req)
        {
            var telefono = string.IsNullOrWhiteSpace(req.Telefono)
                ? $"{req.Nickname.Trim().Substring(0, 1).ToUpper()}X{new Random().Next(100000, 999999)}"
                : req.Telefono.Trim();

            var resultado = await _usuarioService.CrearUsuarioAsync(
                idSitio: req.IdSitio,
                correo: req.Correo.Trim(),
                telefono: telefono,
                fechaNacimiento: req.FechaNacimiento,
                nickname: req.Nickname.Trim(),
                password: req.Password,
                notificaEmail: string.IsNullOrEmpty(req.NotificaEmail) ? "S" : req.NotificaEmail,
                notificaWhatsapp: string.IsNullOrEmpty(req.NotificaWhatsapp) ? "N" : req.NotificaWhatsapp);

            if (resultado.CodigoS != 200)
            {
                return new UsuarioAdminResult
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje,
                    Data = resultado.Data
                };
            }

            long idUsuario = 0;
            try
            {
                using var doc = JsonDocument.Parse(resultado.Data ?? "{}");
                idUsuario = doc.RootElement.GetProperty("id_usuario").GetInt64();
            }
            catch
            {
            }

            if (idUsuario > 0 && !string.IsNullOrWhiteSpace(req.CodigoRol)
                && !req.CodigoRol.Equals("COMPRADOR", StringComparison.OrdinalIgnoreCase))
            {
                var rolResult = await AsignarRolAsync(idUsuario, req.CodigoRol);
                if (rolResult.CodigoS != 200)
                {
                    _logger.LogWarning(
                        "Usuario {Id} creado pero rol {Rol} no asignado: {Msg}",
                        idUsuario, req.CodigoRol, rolResult.Mensaje);
                }
            }

            return new UsuarioAdminResult
            {
                CodigoS = 200,
                Mensaje = $"Usuario creado correctamente con rol {req.CodigoRol}.",
                Data = resultado.Data
            };
        }

        public async Task<List<UsuarioAdminRow>> ListarUsuariosAsync(string soloActivos = "N")
        {
            var lista = new List<UsuarioAdminRow>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_USUARIO.SP_LISTAR_USUARIOS", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_SOLO_ACTIVOS", OracleDbType.Char).Value = soloActivos;
                var oDatos = new OracleParameter("O_DATOS", OracleDbType.RefCursor)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oDatos);

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(MapRow(reader));
                }
                _logger.LogInformation("SP_LISTAR_USUARIOS total={Count}", lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_USUARIO.SP_LISTAR_USUARIOS");
            }
            return lista;
        }

        // Equivalente a VW_GESTOR_USUARIOS; compatible con instalaciones sin
        // los procedimientos de lectura nuevos. Los filtros siempre se parametrizan.
        private const string ConsultaGestor = """
            SELECT
                U.ID_USUARIO,
                U.NICKNAME,
                U.CORREO,
                U.TELEFONO,
                U.FECHA_NACIMIENTO,
                CASE
                    WHEN U.FECHA_NACIMIENTO IS NULL THEN NULL
                    ELSE TRUNC(MONTHS_BETWEEN(SYSDATE, U.FECHA_NACIMIENTO) / 12)
                END AS EDAD,
                U.ID_SITIO,
                U.ACTIVO,
                U.BLOQUEADO,
                U.INTENTOS_FALLIDOS,
                U.ULTIMO_ACCESO,
                U.NOTIFICA_EMAIL,
                U.NOTIFICA_WHATSAPP,
                (SELECT LISTAGG(R.CODIGO, ',') WITHIN GROUP (ORDER BY R.CODIGO)
                   FROM USUARIO_ROL UR
                   JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                  WHERE UR.ID_USUARIO = U.ID_USUARIO
                    AND R.ACTIVO = 'S') AS ROLES,
                (SELECT COUNT(*)
                   FROM USUARIO_ROL UR
                   JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                  WHERE UR.ID_USUARIO = U.ID_USUARIO
                    AND R.ACTIVO = 'S') AS CANT_ROLES,
                (SELECT COUNT(DISTINCT P.ID_PERMISO)
                   FROM USUARIO_ROL UR
                   JOIN ROL_PERMISO RP ON RP.ID_ROL = UR.ID_ROL
                   JOIN PERMISO P    ON P.ID_PERMISO = RP.ID_PERMISO
                  WHERE UR.ID_USUARIO = U.ID_USUARIO
                    AND P.ACTIVO = 'S') AS CANT_PERMISOS,
                (SELECT MAX(BA.FECHA_EVENTO)
                   FROM BITACORA_ACCESO BA
                  WHERE BA.ID_USUARIO = U.ID_USUARIO
                    AND BA.RESULTADO = 'S') AS ULTIMA_CONEXION_OK,
                (SELECT MAX(BA.FECHA_EVENTO)
                   FROM BITACORA_ACCESO BA
                  WHERE BA.ID_USUARIO = U.ID_USUARIO
                    AND BA.RESULTADO = 'N') AS ULTIMA_CONEXION_FALLIDA,
                (SELECT COUNT(*)
                   FROM BITACORA_ACCESO BA
                  WHERE BA.ID_USUARIO = U.ID_USUARIO) AS TOTAL_ACCESOS
            FROM USUARIO U
            """;

        public async Task<List<UsuarioGestorRow>> ListarUsuariosGestorAsync(string soloActivos = "N")
        {
            var lista = new List<UsuarioGestorRow>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(ConsultaGestor + " WHERE (:P_SOLO_ACTIVOS = 'N' OR U.ACTIVO = 'S') ORDER BY U.ID_USUARIO DESC", connection);
                command.BindByName = true;

                command.Parameters.Add("P_SOLO_ACTIVOS", OracleDbType.Char).Value = soloActivos;

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(MapGestorRow(reader));
                }
                _logger.LogInformation("Consulta gestor usuarios total={Count}", lista.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando usuarios del gestor");
            }
            return lista;
        }

        public async Task<UsuarioGestorRow?> ObtenerUsuarioGestorAsync(long idUsuario)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(ConsultaGestor + " WHERE U.ID_USUARIO = :P_ID_USUARIO", connection);
                command.BindByName = true;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return MapGestorRow(reader);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando usuario del gestor id={Id}", idUsuario);
            }
            return null;
        }

        public async Task<List<RolRow>> ListarRolesAsync()
        {
            var lista = new List<RolRow>();
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("SELECT ID_ROL, CODIGO, NOMBRE, DESCRIPCION, ACTIVO FROM ROL WHERE ACTIVO = 'S' ORDER BY ID_ROL", connection);


                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new RolRow
                    {
                        IdRol = reader.GetInt64(reader.GetOrdinal("ID_ROL")),
                        Codigo = reader.GetString(reader.GetOrdinal("CODIGO")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        Descripcion = reader.IsDBNull(reader.GetOrdinal("DESCRIPCION"))
                            ? null : reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                        Activo = reader.GetString(reader.GetOrdinal("ACTIVO")),
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando roles");
            }
            return lista;
        }

        public async Task<UsuarioAdminResult> ObtenerUsuarioAsync(long idUsuario)
        {
            return await EjecutarMagnametsAsync(
                idUsuario: idUsuario,
                opcion: "R");
        }

        public async Task<UsuarioAdminResult> ActualizarUsuarioAsync(
            long idUsuario,
            string? correo,
            string? telefono,
            DateTime? fechaNacimiento,
            string? nickname,
            string? notificaEmail,
            string? notificaWhatsapp)
        {
            return await EjecutarMagnametsAsync(
                idUsuario: idUsuario,
                correo: correo,
                telefono: telefono,
                fechaNacimiento: fechaNacimiento,
                nickname: nickname,
                notificaEmail: notificaEmail,
                notificaWhatsapp: notificaWhatsapp,
                opcion: "U");
        }

        public async Task<UsuarioAdminResult> CambiarEstadoUsuarioAsync(long idUsuario, bool activo)
        {
            return await EjecutarMagnametsAsync(
                idUsuario: idUsuario,
                opcion: activo ? "A" : "D");
        }

        public async Task<UsuarioAdminResult> ActualizarUsuarioGestorAsync(
            long idUsuario,
            string correo,
            string telefono,
            DateTime? fechaNacimiento,
            string nickname,
            string notificaEmail,
            string notificaWhatsapp)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_SEGURIDAD.SP_ACTUALIZAR_USUARIO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
                command.Parameters.Add("P_CORREO", OracleDbType.Varchar2).Value = correo;
                command.Parameters.Add("P_TELEFONO", OracleDbType.Varchar2).Value = telefono;
                command.Parameters.Add("P_FECHA_NACIMIENTO", OracleDbType.Date).Value =
                    (object?)fechaNacimiento ?? DBNull.Value;
                command.Parameters.Add("P_NICKNAME", OracleDbType.Varchar2).Value = nickname;
                command.Parameters.Add("P_NOTIFICA_EMAIL", OracleDbType.Char).Value = notificaEmail;
                command.Parameters.Add("P_NOTIFICA_WHATSAPP", OracleDbType.Char).Value = notificaWhatsapp;

                await command.ExecuteNonQueryAsync();
                _logger.LogInformation(
                    "SP_ACTUALIZAR_USUARIO id={Id} nickname={Nick} correo={Cor}",
                    idUsuario, nickname, correo);

                return new UsuarioAdminResult
                {
                    CodigoS = 200,
                    Mensaje = "Usuario actualizado correctamente.",
                    Data = null
                };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex, "SP_ACTUALIZAR_USUARIO error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20110 => 400,
                    -20111 => 404,
                    -20112 => 409,
                    _ => 500
                };
                return new UsuarioAdminResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "").TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' '),
                    Data = null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_SEGURIDAD.SP_ACTUALIZAR_USUARIO id={Id}", idUsuario);
                return new UsuarioAdminResult { CodigoS = 500, Mensaje = "Error interno.", Data = null };
            }
        }

        public async Task<UsuarioAdminResult> CambiarEstadoSeguridadAsync(
            long idUsuario, string opcionSeguridad)
        {
            try
            {
                var spNombre = opcionSeguridad switch
                {
                    "A" => "SP_ACTIVAR_USUARIO",
                    "D" => "SP_DESACTIVAR_USUARIO",
                    "B" => "SP_BLOQUEAR_USUARIO",
                    "L" => "SP_DESBLOQUEAR_USUARIO",
                    _ => null
                };

                if (spNombre is null)
                {
                    return new UsuarioAdminResult
                    {
                        CodigoS = 400,
                        Mensaje = "Opcion invalida. Use A | D | B | L."
                    };
                }

                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand(
                    $"PKG_SEGURIDAD.{spNombre}", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;

                await command.ExecuteNonQueryAsync();
                _logger.LogInformation(
                    "{Sp} id={Id}", spNombre, idUsuario);

                var msg = spNombre switch
                {
                    "SP_ACTIVAR_USUARIO" => "Usuario activado.",
                    "SP_DESACTIVAR_USUARIO" => "Usuario desactivado.",
                    "SP_BLOQUEAR_USUARIO" => "Usuario bloqueado.",
                    _ => "Usuario desbloqueado."
                };

                return new UsuarioAdminResult { CodigoS = 200, Mensaje = msg };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex,
                    "PKG_SEGURIDAD cambio estado error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20108 or -20118 => 404,
                    _ => 500
                };
                return new UsuarioAdminResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "")
                        .TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' '),
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error ejecutando cambio de estado id={Id}", idUsuario);
                return new UsuarioAdminResult { CodigoS = 500, Mensaje = "Error interno." };
            }
        }

        public async Task<UsuarioAdminResult> AsignarRolAsync(long idUsuario, string codigoRol)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_SEGURIDAD.SP_ASIGNAR_ROL", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
                command.Parameters.Add("P_CODIGO_ROL", OracleDbType.Varchar2).Value = codigoRol;

                await command.ExecuteNonQueryAsync();
                _logger.LogInformation("SP_ASIGNAR_ROL id={Id} rol={Rol}", idUsuario, codigoRol);

                return new UsuarioAdminResult
                {
                    CodigoS = 200,
                    Mensaje = $"Rol {codigoRol} asignado correctamente.",
                    Data = null
                };
            }
            catch (OracleException ex)
            {
                _logger.LogWarning(ex, "SP_ASIGNAR_ROL error code={Code}", ex.Number);
                var codigoS = ex.Number switch
                {
                    -20105 => 404,
                    -20106 => 400,
                    _ => 500
                };
                return new UsuarioAdminResult
                {
                    CodigoS = codigoS,
                    Mensaje = ex.Message.Replace("ORA-20", "").TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ' '),
                    Data = null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_SEGURIDAD.SP_ASIGNAR_ROL");
                return new UsuarioAdminResult { CodigoS = 500, Mensaje = "Error interno.", Data = null };
            }
        }

        private async Task<UsuarioAdminResult> EjecutarMagnametsAsync(
            long? idUsuario = null,
            long? idSitio = null,
            string? correo = null,
            string? telefono = null,
            DateTime? fechaNacimiento = null,
            string? nickname = null,
            string? password = null,
            string? notificaEmail = null,
            string? notificaWhatsapp = null,
            string? activo = null,
            string? bloqueado = null,
            long? idFotoOriginal = null,
            long? idFotoModificada = null,
            long? idRol = null,
            string opcion = "R")
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_USUARIO.MAGNAMETS_USER", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("p_id_usuario", OracleDbType.Int64).Value =
                    (object?)idUsuario ?? DBNull.Value;
                command.Parameters.Add("p_id_sitio", OracleDbType.Int64).Value =
                    (object?)idSitio ?? DBNull.Value;
                command.Parameters.Add("p_correo", OracleDbType.Varchar2).Value =
                    (object?)correo ?? DBNull.Value;
                command.Parameters.Add("p_telefono", OracleDbType.Varchar2).Value =
                    (object?)telefono ?? DBNull.Value;
                command.Parameters.Add("p_fecha_nacimiento", OracleDbType.Date).Value =
                    (object?)fechaNacimiento ?? DBNull.Value;
                command.Parameters.Add("p_nickname", OracleDbType.Varchar2).Value =
                    (object?)nickname ?? DBNull.Value;
                command.Parameters.Add("p_password", OracleDbType.Varchar2).Value =
                    (object?)password ?? DBNull.Value;
                command.Parameters.Add("p_notifica_email", OracleDbType.Char).Value =
                    (object?)notificaEmail ?? DBNull.Value;
                command.Parameters.Add("p_notifica_whatsapp", OracleDbType.Char).Value =
                    (object?)notificaWhatsapp ?? DBNull.Value;
                command.Parameters.Add("p_activo", OracleDbType.Char).Value =
                    (object?)activo ?? DBNull.Value;
                command.Parameters.Add("p_bloqueado", OracleDbType.Char).Value =
                    (object?)bloqueado ?? DBNull.Value;
                command.Parameters.Add("p_id_foto_original", OracleDbType.Int64).Value =
                    (object?)idFotoOriginal ?? DBNull.Value;
                command.Parameters.Add("p_id_foto_modificada", OracleDbType.Int64).Value =
                    (object?)idFotoModificada ?? DBNull.Value;
                command.Parameters.Add("p_id_rol", OracleDbType.Int64).Value =
                    (object?)idRol ?? DBNull.Value;
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

                _logger.LogInformation(
                    "PKG_USUARIO.MAGNAMETS_USER opcion={Op} codigo={Cod} mensaje={Msg}",
                    opcion, codigoS, mensaje);

                return new UsuarioAdminResult
                {
                    CodigoS = codigoS,
                    Mensaje = mensaje,
                    Data = data
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_USUARIO.MAGNAMETS_USER opcion={Op}", opcion);
                return new UsuarioAdminResult
                {
                    CodigoS = 500,
                    Mensaje = "Error interno al ejecutar la operacion.",
                    Data = null
                };
            }
        }

        private static UsuarioAdminRow MapRow(OracleDataReader reader)
        {
            var row = new UsuarioAdminRow
            {
                IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO")),
                IdSitio = reader.IsDBNull(reader.GetOrdinal("ID_SITIO"))
                    ? null : reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                Correo = reader.GetString(reader.GetOrdinal("CORREO")),
                Telefono = reader.GetString(reader.GetOrdinal("TELEFONO")),
                Nickname = reader.GetString(reader.GetOrdinal("NICKNAME")),
                Activo = reader.GetString(reader.GetOrdinal("ACTIVO")),
                Bloqueado = reader.GetString(reader.GetOrdinal("BLOQUEADO")),
                NotificaEmail = reader.GetString(reader.GetOrdinal("NOTIFICA_EMAIL")),
                NotificaWhatsapp = reader.GetString(reader.GetOrdinal("NOTIFICA_WHATSAPP")),
                IntentosFallidos = reader.GetInt32(reader.GetOrdinal("INTENTOS_FALLIDOS")),
                Roles = reader.IsDBNull(reader.GetOrdinal("ROLES"))
                    ? "" : reader.GetString(reader.GetOrdinal("ROLES")),
            };

            var ordFecha = reader.GetOrdinal("FECHA_NACIMIENTO");
            if (!reader.IsDBNull(ordFecha))
                row.FechaNacimiento = reader.GetDateTime(ordFecha).ToString("yyyy-MM-dd");

            var ordUltimo = reader.GetOrdinal("ULTIMO_ACCESO");
            if (!reader.IsDBNull(ordUltimo))
                row.UltimoAcceso = reader.GetDateTime(ordUltimo);

            var ordCreacion = reader.GetOrdinal("FECHA_CREACION");
            if (!reader.IsDBNull(ordCreacion))
                row.FechaCreacion = reader.GetDateTime(ordCreacion);

            return row;
        }

        private static UsuarioGestorRow MapGestorRow(OracleDataReader reader)
        {
            var row = new UsuarioGestorRow
            {
                IdUsuario = reader.GetInt64(reader.GetOrdinal("ID_USUARIO")),
                Nickname = reader.GetString(reader.GetOrdinal("NICKNAME")),
                Correo = reader.GetString(reader.GetOrdinal("CORREO")),
                Telefono = reader.GetString(reader.GetOrdinal("TELEFONO")),
                Activo = reader.GetString(reader.GetOrdinal("ACTIVO")),
                Bloqueado = reader.GetString(reader.GetOrdinal("BLOQUEADO")),
                IntentosFallidos = reader.GetInt32(reader.GetOrdinal("INTENTOS_FALLIDOS")),
                NotificaEmail = reader.GetString(reader.GetOrdinal("NOTIFICA_EMAIL")),
                NotificaWhatsapp = reader.GetString(reader.GetOrdinal("NOTIFICA_WHATSAPP")),
                CantRoles = reader.GetInt32(reader.GetOrdinal("CANT_ROLES")),
                CantPermisos = reader.GetInt32(reader.GetOrdinal("CANT_PERMISOS")),
                TotalAccesos = reader.GetInt32(reader.GetOrdinal("TOTAL_ACCESOS")),
                Roles = reader.IsDBNull(reader.GetOrdinal("ROLES"))
                    ? "" : reader.GetString(reader.GetOrdinal("ROLES")),
            };

            var ordEdad = reader.GetOrdinal("EDAD");
            if (!reader.IsDBNull(ordEdad))
                row.Edad = reader.GetInt32(ordEdad);

            var ordSitio = reader.GetOrdinal("ID_SITIO");
            if (!reader.IsDBNull(ordSitio))
                row.IdSitio = reader.GetInt64(ordSitio);

            var ordFecha = reader.GetOrdinal("FECHA_NACIMIENTO");
            if (!reader.IsDBNull(ordFecha))
                row.FechaNacimiento = reader.GetDateTime(ordFecha).ToString("yyyy-MM-dd");

            var ordUltimo = reader.GetOrdinal("ULTIMO_ACCESO");
            if (!reader.IsDBNull(ordUltimo))
                row.UltimoAcceso = reader.GetDateTime(ordUltimo);

            var ordOk = reader.GetOrdinal("ULTIMA_CONEXION_OK");
            if (!reader.IsDBNull(ordOk))
                row.UltimaConexionOk = reader.GetDateTime(ordOk);

            var ordFall = reader.GetOrdinal("ULTIMA_CONEXION_FALLIDA");
            if (!reader.IsDBNull(ordFall))
                row.UltimaConexionFallida = reader.GetDateTime(ordFall);

            return row;
        }
    }
}
