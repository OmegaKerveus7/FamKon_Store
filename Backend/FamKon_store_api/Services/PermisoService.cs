using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using System.Data;

namespace FamKon_store_api.Services
{
    public class Permiso
    {
        public string CodigoRol { get; set; } = string.Empty;
        public string Rol { get; set; } = string.Empty;
        public string CodigoPermiso { get; set; } = string.Empty;
        public string PermisoNombre { get; set; } = string.Empty;
        public string Modulo { get; set; } = string.Empty;
    }

    public class PermisoService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<PermisoService> _logger;

        public PermisoService(DBContext dbContext, ILogger<PermisoService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<List<Permiso>> ListarPermisosAsync(long idUsuario)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_SEGURIDAD.SP_LISTAR_PERMISOS", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;

                var oDatos = new OracleParameter("O_DATOS", OracleDbType.RefCursor)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oDatos);

                var permisos = new List<Permiso>();

                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    permisos.Add(new Permiso
                    {
                        CodigoRol = reader.GetString(reader.GetOrdinal("CODIGO_ROL")),
                        Rol = reader.GetString(reader.GetOrdinal("ROL")),
                        CodigoPermiso = reader.GetString(reader.GetOrdinal("CODIGO_PERMISO")),
                        PermisoNombre = reader.GetString(reader.GetOrdinal("PERMISO")),
                        Modulo = reader.GetString(reader.GetOrdinal("MODULO"))
                    });
                }

                _logger.LogInformation("SP_LISTAR_PERMISOS usuario={Id} permisos={Count}", idUsuario, permisos.Count);
                return permisos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando SP_LISTAR_PERMISOS usuario={Id}", idUsuario);
                return new List<Permiso>();
            }
        }
    }
}
