using System.Data;
using System.Text.Json;
using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace FamKon_store_api.Services
{
    public class PersonalizacionContenido
    {
        public long? IdArchivoLadoA { get; set; }
        public long? IdArchivoLadoB { get; set; }
        public string? MensajeLadoA { get; set; }
        public string? MensajeLadoB { get; set; }
        public string? ConfigLadoA { get; set; }
        public string? ConfigLadoB { get; set; }
    }

    public class PersonalizacionDto
    {
        public long IdPersonalizacion { get; set; }
        public long? IdUsuario { get; set; }
        public long? IdProducto { get; set; }
        public long? IdArchivoLadoA { get; set; }
        public long? IdArchivoLadoB { get; set; }
        public string? MensajeLadoA { get; set; }
        public string? MensajeLadoB { get; set; }
        public string? ConfigLadoA { get; set; }
        public string? ConfigLadoB { get; set; }
        public string Bloqueada { get; set; } = "N";
        public string? Producto { get; set; }
        public string? SkuProducto { get; set; }
        public string? FechaCreacion { get; set; }
    }

    public class PersonalizacionService
    {
        private const int MaximoMensaje = 500;
        private const int MaximoConfig = 4000;
        private const int MaximoImagen = 5 * 1024 * 1024;

        private readonly DBContext _dbContext;
        private readonly ArchivoService _archivos;
        private readonly CompraService _compras;
        private readonly ILogger<PersonalizacionService> _logger;

        public PersonalizacionService(
            DBContext dbContext,
            ArchivoService archivos,
            CompraService compras,
            ILogger<PersonalizacionService> logger)
        {
            _dbContext = dbContext;
            _archivos = archivos;
            _compras = compras;
            _logger = logger;
        }

        public async Task<long> CrearAsync(long idUsuario, long idProducto, PersonalizacionContenido contenido)
        {
            Normalizar(contenido);
            if (string.IsNullOrEmpty(contenido.MensajeLadoA) && string.IsNullOrEmpty(contenido.MensajeLadoB)
                && contenido.IdArchivoLadoA is null && contenido.IdArchivoLadoB is null
                && string.IsNullOrEmpty(contenido.ConfigLadoA) && string.IsNullOrEmpty(contenido.ConfigLadoB))
                throw new InvalidOperationException("Agrega una imagen, un mensaje o una configuración para personalizar el producto.");

            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_PERSONALIZACION.SP_CREAR", connection)
            {
                CommandType = CommandType.StoredProcedure,
                BindByName = true
            };
            command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
            command.Parameters.Add("P_ID_PRODUCTO", OracleDbType.Int64).Value = idProducto;
            AgregarParametros(command, contenido);
            var salida = new OracleParameter("O_ID_PERSONALIZACION", OracleDbType.Int64)
            {
                Direction = ParameterDirection.Output
            };
            command.Parameters.Add(salida);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)salida.Value).ToInt64();
        }

        public async Task<PersonalizacionDto?> ActualizarAsync(long idUsuario, long idPersonalizacion, PersonalizacionContenido contenido)
        {
            Normalizar(contenido);
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_PERSONALIZACION.SP_ACTUALIZAR", connection)
            {
                CommandType = CommandType.StoredProcedure,
                BindByName = true
            };
            command.Parameters.Add("P_ID_PERSONALIZACION", OracleDbType.Int64).Value = idPersonalizacion;
            command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int64).Value = idUsuario;
            AgregarParametros(command, contenido);

            await command.ExecuteNonQueryAsync();
            return await ObtenerAsync(idPersonalizacion);
        }

        public async Task<PersonalizacionDto?> ObtenerAsync(long idPersonalizacion)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_PERSONALIZACION.SP_OBTENER", connection)
            {
                CommandType = CommandType.StoredProcedure,
                BindByName = true
            };
            command.Parameters.Add("P_ID_PERSONALIZACION", OracleDbType.Int64).Value = idPersonalizacion;
            command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            using var reader = await command.ExecuteReaderAsync();
            if (!await reader.ReadAsync()) return null;

            return new PersonalizacionDto
            {
                IdPersonalizacion = reader.GetInt64(reader.GetOrdinal("ID_PERSONALIZACION")),
                IdUsuario = LeerLong(reader, "ID_USUARIO"),
                IdProducto = LeerLong(reader, "ID_PRODUCTO"),
                IdArchivoLadoA = LeerLong(reader, "ID_ARCHIVO_LADO_A"),
                IdArchivoLadoB = LeerLong(reader, "ID_ARCHIVO_LADO_B"),
                MensajeLadoA = LeerTexto(reader, "MENSAJE_LADO_A"),
                MensajeLadoB = LeerTexto(reader, "MENSAJE_LADO_B"),
                ConfigLadoA = LeerClob(reader, "CONFIG_LADO_A"),
                ConfigLadoB = LeerClob(reader, "CONFIG_LADO_B"),
                Bloqueada = LeerTexto(reader, "BLOQUEADA") ?? "N",
                Producto = LeerTexto(reader, "PRODUCTO"),
                SkuProducto = LeerTexto(reader, "SKU_PRODUCTO"),
                FechaCreacion = LeerTexto(reader, "FECHA_CREACION"),
            };
        }

        public async Task<bool> PuedeVerAsync(long actor, long idPersonalizacion)
        {
            var personalizacion = await ObtenerAsync(idPersonalizacion);
            if (personalizacion is null) return false;
            if (personalizacion.IdUsuario == actor) return true;
            if (await _compras.EsAdmin(actor)) return true;

            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);
            using var command = new OracleCommand("""
                SELECT COUNT(*)
                  FROM PERSONALIZACION PR
                  JOIN PEDIDO_DETALLE D ON D.ID_PERSONALIZACION = PR.ID_PERSONALIZACION
                  JOIN ENTREGA E ON E.ID_PEDIDO = D.ID_PEDIDO
                 WHERE PR.ID_PERSONALIZACION = :id
                   AND E.ID_REPARTIDOR = :actor
                """, connection);
            command.Parameters.Add("id", OracleDbType.Int64).Value = idPersonalizacion;
            command.Parameters.Add("actor", OracleDbType.Int64).Value = actor;
            return Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
        }

        public async Task<bool> PuedeUsarEnCarritoAsync(long actor, long idPersonalizacion, long idProducto)
        {
            var personalizacion = await ObtenerAsync(idPersonalizacion);
            return personalizacion is not null
                && personalizacion.IdUsuario == actor
                && personalizacion.IdProducto == idProducto
                && personalizacion.Bloqueada != "S";
        }

        public async Task<long?> SubirImagenAsync(long idUsuario, string lado, IFormFile archivo)
        {
            if (archivo.Length == 0 || archivo.Length > MaximoImagen)
                throw new InvalidOperationException("La imagen debe pesar menos de 5 MB.");

            await using var stream = new MemoryStream();
            await archivo.CopyToAsync(stream);
            var bytes = stream.ToArray();
            var mime = DetectarMime(bytes);
            if (mime is null)
                throw new InvalidOperationException("Formato no válido. Usa JPG, PNG o WEBP.");

            var extension = mime switch
            {
                "image/png" => ".png",
                "image/webp" => ".webp",
                _ => ".jpg"
            };
            var nombre = $"personalizacion_{lado}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            var guardado = await _archivos.GuardarArchivoAsync(idUsuario, "DISENO_PERSONALIZACION", nombre, mime, bytes);
            return guardado?.IdArchivo;
        }

        private static void AgregarParametros(OracleCommand command, PersonalizacionContenido contenido)
        {
            command.Parameters.Add("P_ID_ARCHIVO_LADO_A", OracleDbType.Int64).Value = (object?)contenido.IdArchivoLadoA ?? DBNull.Value;
            command.Parameters.Add("P_ID_ARCHIVO_LADO_B", OracleDbType.Int64).Value = (object?)contenido.IdArchivoLadoB ?? DBNull.Value;
            command.Parameters.Add("P_MENSAJE_LADO_A", OracleDbType.Varchar2).Value = (object?)contenido.MensajeLadoA ?? DBNull.Value;
            command.Parameters.Add("P_MENSAJE_LADO_B", OracleDbType.Varchar2).Value = (object?)contenido.MensajeLadoB ?? DBNull.Value;
            command.Parameters.Add("P_CONFIG_LADO_A", OracleDbType.Clob).Value = (object?)contenido.ConfigLadoA ?? DBNull.Value;
            command.Parameters.Add("P_CONFIG_LADO_B", OracleDbType.Clob).Value = (object?)contenido.ConfigLadoB ?? DBNull.Value;
        }

        private static void Normalizar(PersonalizacionContenido contenido)
        {
            contenido.MensajeLadoA = NormalizarTexto(contenido.MensajeLadoA, MaximoMensaje, "El mensaje del lado A");
            contenido.MensajeLadoB = NormalizarTexto(contenido.MensajeLadoB, MaximoMensaje, "El mensaje del lado B");
            contenido.ConfigLadoA = NormalizarConfig(contenido.ConfigLadoA, "La configuración del lado A");
            contenido.ConfigLadoB = NormalizarConfig(contenido.ConfigLadoB, "La configuración del lado B");
        }

        private static string? NormalizarTexto(string? valor, int maximo, string campo)
        {
            if (string.IsNullOrWhiteSpace(valor)) return null;
            var texto = valor.Trim();
            if (texto.Length > maximo) throw new InvalidOperationException($"{campo} no puede superar los {maximo} caracteres.");
            return texto;
        }

        private static string? NormalizarConfig(string? valor, string campo)
        {
            if (string.IsNullOrWhiteSpace(valor)) return null;
            var config = valor.Trim();
            if (config.Length > MaximoConfig) throw new InvalidOperationException($"{campo} es demasiado grande.");

            try
            {
                using var documento = JsonDocument.Parse(config);
                if (documento.RootElement.ValueKind != JsonValueKind.Object)
                    throw new InvalidOperationException($"{campo} debe ser un objeto JSON.");
                if (documento.RootElement.TryGetProperty("url", out var url) && url.ValueKind != JsonValueKind.Null)
                {
                    if (url.ValueKind != JsonValueKind.String)
                        throw new InvalidOperationException("La URL de la personalización no es válida.");
                    var texto = url.GetString()!.Trim();
                    if (texto.Length > 500 || !Uri.TryCreate(texto, UriKind.Absolute, out var uri)
                        || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                        throw new InvalidOperationException("La URL debe comenzar con http:// o https:// y tener máximo 500 caracteres.");
                }
            }
            catch (JsonException)
            {
                throw new InvalidOperationException($"{campo} no es un JSON válido.");
            }

            return config;
        }

        private static long? LeerLong(OracleDataReader reader, string columna)
        {
            var ordinal = reader.GetOrdinal(columna);
            return reader.IsDBNull(ordinal) ? null : reader.GetInt64(ordinal);
        }

        private static string? LeerTexto(OracleDataReader reader, string columna)
        {
            var ordinal = reader.GetOrdinal(columna);
            return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
        }

        private static string? LeerClob(OracleDataReader reader, string columna)
        {
            var ordinal = reader.GetOrdinal(columna);
            if (reader.IsDBNull(ordinal)) return null;
            using var clob = reader.GetOracleClob(ordinal);
            return clob.IsNull ? null : clob.Value;
        }

        private static string? DetectarMime(byte[] bytes)
        {
            if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return "image/jpeg";
            if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return "image/png";
            if (bytes.Length >= 12 && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50) return "image/webp";
            return null;
        }
    }
}
