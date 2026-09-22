using System.Data;
using System.Security.Cryptography;
using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace FamKon_store_api.Services
{
    public class ArchivoGuardado
    {
        public long IdArchivo { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public long TamanoBytes { get; set; }
    }

    public class ArchivoService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<ArchivoService> _logger;

        public ArchivoService(DBContext dbContext, ILogger<ArchivoService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<ArchivoGuardado?> GuardarArchivoAsync(
            long idUsuarioCarga,
            string tipoArchivo,
            string nombreArchivo,
            string mimeType,
            byte[] contenido)
        {
            try
            {
                if (contenido == null || contenido.Length == 0)
                {
                    _logger.LogWarning("SP_GUARDAR_ARCHIVO contenido vacio");
                    return null;
                }

                var hash = CalcularSha256(contenido);

                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_ARCHIVO.SP_GUARDAR_ARCHIVO", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_USUARIO_CARGA", OracleDbType.Int64).Value = idUsuarioCarga;
                command.Parameters.Add("P_TIPO_ARCHIVO", OracleDbType.Varchar2).Value = tipoArchivo;
                command.Parameters.Add("P_NOMBRE_ARCHIVO", OracleDbType.Varchar2).Value = nombreArchivo;
                command.Parameters.Add("P_MIME_TYPE", OracleDbType.Varchar2).Value = mimeType;
                command.Parameters.Add("P_HASH_SHA256", OracleDbType.Varchar2).Value = hash;

                var pContenido = new OracleParameter("P_CONTENIDO", OracleDbType.Blob)
                {
                    Value = contenido
                };
                command.Parameters.Add(pContenido);

                var oIdArchivo = new OracleParameter("O_ID_ARCHIVO", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oIdArchivo);

                await command.ExecuteNonQueryAsync();

                long idArchivo = 0;
                if (oIdArchivo.Value != null && oIdArchivo.Value != DBNull.Value)
                    idArchivo = ((OracleDecimal)oIdArchivo.Value).ToInt64();

                _logger.LogInformation(
                    "SP_GUARDAR_ARCHIVO id={Id} tipo={Tipo} bytes={Bytes}",
                    idArchivo, tipoArchivo, contenido.Length);

                return new ArchivoGuardado
                {
                    IdArchivo = idArchivo,
                    Nombre = nombreArchivo,
                    Tipo = tipoArchivo,
                    MimeType = mimeType,
                    TamanoBytes = contenido.Length,
                };
            }
            catch (OracleException ex)
            {
                _logger.LogError(ex,
                    "SP_GUARDAR_ARCHIVO oracle error code={Code}", ex.Number);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando PKG_ARCHIVO.SP_GUARDAR_ARCHIVO");
                return null;
            }
        }

        public async Task<(byte[]? contenido, string mimeType, string nombre)> ObtenerArchivoAsync(long idArchivo)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_ARCHIVO.SP_OBTENER_ARCHIVO", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_ARCHIVO", OracleDbType.Int64).Value = idArchivo;

                var oDatos = new OracleParameter("O_DATOS", OracleDbType.RefCursor)
                {
                    Direction = ParameterDirection.Output
                };
                command.Parameters.Add(oDatos);

                using var reader = await command.ExecuteReaderAsync();
                if (!await reader.ReadAsync()) return (null, "", "");

                string mime = reader.IsDBNull(reader.GetOrdinal("MIME_TYPE"))
                    ? "application/octet-stream"
                    : reader.GetString(reader.GetOrdinal("MIME_TYPE"));
                string nombre = reader.IsDBNull(reader.GetOrdinal("NOMBRE_ARCHIVO"))
                    ? $"archivo_{idArchivo}"
                    : reader.GetString(reader.GetOrdinal("NOMBRE_ARCHIVO"));

                var blob = reader.GetOracleBlob(reader.GetOrdinal("CONTENIDO"));
                byte[] bytes;
                using (blob)
                {
                    bytes = blob.IsNull ? Array.Empty<byte>() : blob.Value ?? Array.Empty<byte>();
                }

                return (bytes, mime, nombre);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ejecutando SP_OBTENER_ARCHIVO id={Id}", idArchivo);
                return (null, "", "");
            }
        }

        private static string CalcularSha256(byte[] data)
        {
            var hash = SHA256.HashData(data);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }
    }
}
