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

    /// <summary>Producto personalizado de un pedido que debe prepararse antes de entregarse.</summary>
    public class PreparacionPersonalizadaDto
    {
        public long IdPedidoDetalle { get; set; }
        public long IdPedido { get; set; }
        public string NumeroPedido { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public string EstadoNombre { get; set; } = string.Empty;
        public string? Comprador { get; set; }
        public string? Telefono { get; set; }
        public string? AreaEntrega { get; set; }
        public string? Direccion { get; set; }
        public string? Repartidor { get; set; }
        public string Producto { get; set; } = string.Empty;
        public string Sku { get; set; } = string.Empty;
        public int Cantidad { get; set; }
        public long? IdPersonalizacion { get; set; }
        public long? IdArchivoLadoA { get; set; }
        public long? IdArchivoLadoB { get; set; }
        public string? MensajeLadoA { get; set; }
        public string? MensajeLadoB { get; set; }
        public string? ConfigLadoA { get; set; }
        public string? ConfigLadoB { get; set; }
        public string? UrlNfc { get; set; }
        public bool Preparada { get; set; }
        public string? FechaPreparacion { get; set; }
        /// <summary>Ancho real del recuadro a imprimir (cm). Null = usar el valor por defecto.</summary>
        public decimal? AnchoCm { get; set; }
        /// <summary>Alto real del recuadro a imprimir (cm). Null = usar el valor por defecto.</summary>
        public decimal? AltoCm { get; set; }
    }

    /// <summary>Resultado de marcar/desmarcar una línea como preparada.</summary>
    public class ResultadoPreparacionDto
    {
        public bool Actualizado { get; set; }
        public long IdPedido { get; set; }
        public string? EstadoPedido { get; set; }
        public bool Avanzado { get; set; }
        public string? Motivo { get; set; }
    }

    public class PreparacionesResumenDto
    {
        public int Pedidos { get; set; }
        public int LineasPendientes { get; set; }
        public int ProductosPendientes { get; set; }
        public int LineasPreparadas { get; set; }
        public int TotalLineas { get; set; }
    }

    public class PreparacionesDto
    {
        public PreparacionesResumenDto Resumen { get; set; } = new();
        public List<PreparacionPersonalizadaDto> Items { get; set; } = new();
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
            if (await EsSupervisorAsync(connection, actor)) return true;
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

        /// <summary>
        /// Productos personalizados de pedidos activos. Solo lo consumen supervisor
        /// y admin, por lo que se listan todos los pedidos.
        /// </summary>
        public async Task<PreparacionesDto> ListarPreparacionesAsync(long actor)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            const string sql = """
                SELECT D.ID_PEDIDO_DETALLE, D.ID_PEDIDO, P.NUMERO_PEDIDO,
                       EP.CODIGO ESTADO, EP.NOMBRE ESTADO_NOMBRE,
                       U.NICKNAME COMPRADOR, P.TELEFONO_CONTACTO, P.DIRECCION_ENTREGA,
                       AE.NOMBRE AREA_ENTREGA,
                       (SELECT LISTAGG(RP.NICKNAME, ', ') WITHIN GROUP (ORDER BY RP.NICKNAME)
                          FROM (SELECT DISTINCT U2.NICKNAME
                                  FROM ENTREGA E2 JOIN USUARIO U2 ON U2.ID_USUARIO = E2.ID_REPARTIDOR
                                 WHERE E2.ID_PEDIDO = P.ID_PEDIDO) RP) REPARTIDOR,
                       D.NOMBRE_PRODUCTO, D.SKU_PRODUCTO, D.CANTIDAD,
                       D.ID_PERSONALIZACION,
                       PR.ID_ARCHIVO_LADO_A, PR.ID_ARCHIVO_LADO_B,
                       PR.MENSAJE_LADO_A, PR.MENSAJE_LADO_B,
                       PR.CONFIG_LADO_A, PR.CONFIG_LADO_B,
                       NVL(D.PERSONALIZACION_PREPARADA, 'N') PREPARADA,
                       TO_CHAR(D.FECHA_PREPARACION, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA_PREPARACION,
                       PD.ANCHO_CM, PD.ALTO_CM
                  FROM PEDIDO_DETALLE D
                  JOIN PEDIDO P ON P.ID_PEDIDO = D.ID_PEDIDO
                  JOIN ESTADO_PEDIDO EP ON EP.ID_ESTADO_PEDIDO = P.ID_ESTADO_PEDIDO
                  LEFT JOIN USUARIO U ON U.ID_USUARIO = P.ID_USUARIO
                  LEFT JOIN AREA_ENTREGA AE ON AE.ID_AREA_ENTREGA = P.ID_AREA_ENTREGA
                  LEFT JOIN PERSONALIZACION PR ON PR.ID_PERSONALIZACION = D.ID_PERSONALIZACION
                  LEFT JOIN PRODUCTO PD ON PD.ID_PRODUCTO = D.ID_PRODUCTO
                 WHERE D.ID_PERSONALIZACION IS NOT NULL
                   AND EP.CODIGO NOT IN ('ENTREGADO', 'CANCELADO', 'RECOGIDO')
                 ORDER BY P.ID_PEDIDO DESC, D.NUMERO_LINEA
                """;

            using var cmd = new OracleCommand(sql, connection) { BindByName = true };

            var resultado = new PreparacionesDto();
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                long? L(string columna)
                {
                    var i = reader.GetOrdinal(columna);
                    return reader.IsDBNull(i) ? null : reader.GetInt64(i);
                }
                string? T(string columna)
                {
                    var i = reader.GetOrdinal(columna);
                    return reader.IsDBNull(i) ? null : reader.GetString(i);
                }
                decimal? M(string columna)
                {
                    var i = reader.GetOrdinal(columna);
                    return reader.IsDBNull(i) ? null : reader.GetDecimal(i);
                }

                while (await reader.ReadAsync())
                {
                    var configA = T("CONFIG_LADO_A");
                    var configB = T("CONFIG_LADO_B");
                    resultado.Items.Add(new PreparacionPersonalizadaDto
                    {
                        IdPedidoDetalle = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO_DETALLE")),
                        IdPedido = reader.GetInt64(reader.GetOrdinal("ID_PEDIDO")),
                        NumeroPedido = T("NUMERO_PEDIDO") ?? string.Empty,
                        Estado = T("ESTADO") ?? string.Empty,
                        EstadoNombre = T("ESTADO_NOMBRE") ?? string.Empty,
                        Comprador = T("COMPRADOR"),
                        Telefono = T("TELEFONO_CONTACTO"),
                        AreaEntrega = T("AREA_ENTREGA"),
                        Direccion = T("DIRECCION_ENTREGA"),
                        Repartidor = T("REPARTIDOR"),
                        Producto = T("NOMBRE_PRODUCTO") ?? string.Empty,
                        Sku = T("SKU_PRODUCTO") ?? string.Empty,
                        Cantidad = reader.GetInt32(reader.GetOrdinal("CANTIDAD")),
                        IdPersonalizacion = L("ID_PERSONALIZACION"),
                        IdArchivoLadoA = L("ID_ARCHIVO_LADO_A"),
                        IdArchivoLadoB = L("ID_ARCHIVO_LADO_B"),
                        MensajeLadoA = T("MENSAJE_LADO_A"),
                        MensajeLadoB = T("MENSAJE_LADO_B"),
                        ConfigLadoA = configA,
                        ConfigLadoB = configB,
                        UrlNfc = UrlDeConfig(configA) ?? UrlDeConfig(configB),
                        Preparada = T("PREPARADA") == "S",
                        FechaPreparacion = T("FECHA_PREPARACION"),
                        AnchoCm = M("ANCHO_CM"),
                        AltoCm = M("ALTO_CM"),
                    });
                }
            }

            resultado.Resumen = new PreparacionesResumenDto
            {
                TotalLineas = resultado.Items.Count,
                LineasPreparadas = resultado.Items.Count(i => i.Preparada),
                LineasPendientes = resultado.Items.Count(i => !i.Preparada),
                ProductosPendientes = resultado.Items.Where(i => !i.Preparada).Sum(i => i.Cantidad),
                Pedidos = resultado.Items.Where(i => !i.Preparada).Select(i => i.IdPedido).Distinct().Count(),
            };
            return resultado;
        }

        /// <summary>
        /// Marca (o desmarca) un producto personalizado como preparado. Cuando todas
        /// las lineas personalizadas del pedido quedan listas, el pedido pasa a
        /// LISTO_ENTREGA / LISTO_RECOGER (segun la modalidad) y queda en el tracking.
        /// </summary>
        public async Task<ResultadoPreparacionDto> MarcarPreparadaAsync(long actor, long idPedidoDetalle, bool preparada)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            var resultado = new ResultadoPreparacionDto();

            using (var pedido = new OracleCommand("""
                SELECT D.ID_PEDIDO
                  FROM PEDIDO_DETALLE D
                 WHERE D.ID_PEDIDO_DETALLE = :idDetalle
                   AND D.ID_PERSONALIZACION IS NOT NULL
                """, connection))
            {
                pedido.Parameters.Add("idDetalle", OracleDbType.Int64).Value = idPedidoDetalle;
                var valor = await pedido.ExecuteScalarAsync();
                if (valor is null || valor == DBNull.Value) return resultado;
                resultado.IdPedido = Convert.ToInt64(valor);
            }

            const string sql = """
                UPDATE PEDIDO_DETALLE D
                   SET D.PERSONALIZACION_PREPARADA = :preparada,
                       D.FECHA_PREPARACION = CASE WHEN :preparada = 'S' THEN SYSTIMESTAMP ELSE NULL END,
                       D.ID_USUARIO_PREPARA = CASE WHEN :preparada = 'S' THEN :actor ELSE NULL END
                 WHERE D.ID_PEDIDO_DETALLE = :idDetalle
                   AND D.ID_PERSONALIZACION IS NOT NULL
                """;
            using var cmd = new OracleCommand(sql, connection) { BindByName = true };
            cmd.Parameters.Add("preparada", OracleDbType.Char).Value = preparada ? "S" : "N";
            cmd.Parameters.Add("actor", OracleDbType.Int64).Value = actor;
            cmd.Parameters.Add("idDetalle", OracleDbType.Int64).Value = idPedidoDetalle;
            resultado.Actualizado = await cmd.ExecuteNonQueryAsync() > 0;
            if (!resultado.Actualizado) return resultado;

            var (estado, avanzado, motivo) = await AvanzarSiPersonalizacionCompletaAsync(connection, actor, resultado.IdPedido, preparada);
            resultado.EstadoPedido = estado;
            resultado.Avanzado = avanzado;
            resultado.Motivo = motivo;
            return resultado;
        }

        /// <summary>
        /// Si todas las lineas personalizadas del pedido ya estan preparadas, mueve el
        /// pedido a LISTO_ENTREGA (domicilio) o LISTO_RECOGER (mostrador) usando el
        /// paquete PKG_PEDIDO, que deja el rastro en PEDIDO_ESTADO_HISTORIAL (tracking).
        /// </summary>
        private static async Task<(string? Estado, bool Avanzado, string? Motivo)> AvanzarSiPersonalizacionCompletaAsync(
            OracleConnection connection, long actor, long idPedido, bool preparada)
        {
            if (!preparada) return (null, false, null);

            string? estadoActual = null;
            int modalidad = 0, total = 0, listas = 0;
            using (var cmd = new OracleCommand("""
                SELECT E.CODIGO, P.ID_MODALIDAD_ENTREGA,
                       (SELECT COUNT(*) FROM PEDIDO_DETALLE D
                         WHERE D.ID_PEDIDO = P.ID_PEDIDO AND D.ID_PERSONALIZACION IS NOT NULL) TOTAL,
                       (SELECT COUNT(*) FROM PEDIDO_DETALLE D
                         WHERE D.ID_PEDIDO = P.ID_PEDIDO AND D.ID_PERSONALIZACION IS NOT NULL
                           AND NVL(D.PERSONALIZACION_PREPARADA, 'N') = 'S') LISTAS
                  FROM PEDIDO P
                  JOIN ESTADO_PEDIDO E ON E.ID_ESTADO_PEDIDO = P.ID_ESTADO_PEDIDO
                 WHERE P.ID_PEDIDO = :id
                """, connection))
            {
                cmd.Parameters.Add("id", OracleDbType.Int64).Value = idPedido;
                using var reader = await cmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync()) return (null, false, null);
                estadoActual = reader.GetString(0);
                modalidad = reader.GetInt32(1);
                total = reader.GetInt32(2);
                listas = reader.GetInt32(3);
            }

            if (total == 0 || listas < total) return (estadoActual, false, null);
            if (estadoActual is "LISTO_ENTREGA" or "LISTO_RECOGER" or "EN_RUTA" or "ENTREGADO"
                or "RECOGIDO" or "CANCELADO" or "COMPRADOR_NO_ENCONTRADO")
                return (estadoActual, false, null);

            // Mismo criterio que PKG_COMPRA.AVANZAR: con tarjeta el pago debe estar aprobado.
            using (var pago = new OracleCommand("""
                SELECT M.CODIGO, EP.CODIGO
                  FROM PAGO PG
                  JOIN METODO_PAGO M ON M.ID_METODO_PAGO = PG.ID_METODO_PAGO
                  JOIN ESTADO_PAGO EP ON EP.ID_ESTADO_PAGO = PG.ID_ESTADO_PAGO
                 WHERE PG.ID_PEDIDO = :id
                 ORDER BY PG.ID_PAGO DESC
                 FETCH FIRST 1 ROW ONLY
                """, connection))
            {
                pago.Parameters.Add("id", OracleDbType.Int64).Value = idPedido;
                using var reader = await pago.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    var metodo = reader.IsDBNull(0) ? null : reader.GetString(0);
                    var estadoPago = reader.IsDBNull(1) ? null : reader.GetString(1);
                    if (metodo == "TARJETA" && estadoPago != "APROBADO")
                        return (estadoActual, false, "Falta confirmar el pago con tarjeta.");
                }
            }

            var destino = modalidad == 2 ? "LISTO_ENTREGA" : "LISTO_RECOGER";
            using (var avanzar = new OracleCommand("PKG_PEDIDO.SP_CAMBIAR_ESTADO", connection))
            {
                avanzar.CommandType = CommandType.StoredProcedure;
                avanzar.BindByName = true;
                avanzar.Parameters.Add("P_ID_PEDIDO", OracleDbType.Int64).Value = idPedido;
                avanzar.Parameters.Add("P_CODIGO_ESTADO", OracleDbType.Varchar2).Value = destino;
                avanzar.Parameters.Add("P_ID_USUARIO_ACTOR", OracleDbType.Int64).Value = actor;
                avanzar.Parameters.Add("P_COMENTARIO", OracleDbType.Varchar2).Value =
                    destino == "LISTO_ENTREGA"
                        ? "Personalizacion completada. Listo para entrega."
                        : "Personalizacion completada. Listo para recoger.";
                avanzar.Parameters.Add("P_DIRECCION_IP", OracleDbType.Varchar2).Value = DBNull.Value;
                await avanzar.ExecuteNonQueryAsync();
            }
            return (destino, true, null);
        }

        private static async Task<bool> EsSupervisorAsync(OracleConnection connection, long actor)
        {
            using var cmd = new OracleCommand("""
                SELECT COUNT(*)
                  FROM USUARIO_ROL UR
                  JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                 WHERE UR.ID_USUARIO = :actor
                   AND R.ACTIVO = 'S'
                   AND R.CODIGO = 'SUPERVISOR'
                """, connection);
            cmd.Parameters.Add("actor", OracleDbType.Int64).Value = actor;
            return Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0;
        }

        private static string? UrlDeConfig(string? config)
        {
            if (string.IsNullOrWhiteSpace(config)) return null;
            try
            {
                using var documento = JsonDocument.Parse(config);
                if (documento.RootElement.ValueKind != JsonValueKind.Object) return null;
                return documento.RootElement.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String
                    ? url.GetString()
                    : null;
            }
            catch (JsonException)
            {
                return null;
            }
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
