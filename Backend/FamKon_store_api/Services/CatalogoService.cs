using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace FamKon_store_api.Services
{
    public class ProductoDto
    {
        public long IdProducto { get; set; }
        public long IdSitio { get; set; }
        public long IdCategoria { get; set; }
        public string Categoria { get; set; } = "";
        public long? IdArchivoImagen { get; set; }
        public string Sku { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string Descripcion { get; set; } = "";
        public decimal PrecioBase { get; set; }
        public string PermiteLadoA { get; set; } = "S";
        public string PermiteLadoB { get; set; } = "S";
        public string Activo { get; set; } = "S";
    }

    public class CategoriaDto
    {
        public long IdCategoria { get; set; }
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string Descripcion { get; set; } = "";
    }

    public class AreaEntregaDto
    {
        public long IdAreaEntrega { get; set; }
        public long IdSitio { get; set; }
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string TipoArea { get; set; } = "";
        public string Referencia { get; set; } = "";
        public decimal CargoEntrega { get; set; }
    }

    public class MetodoPagoDto
    {
        public long IdMetodoPago { get; set; }
        public string Codigo { get; set; } = "";
        public string Nombre { get; set; } = "";
        public string RequiereProveedor { get; set; } = "N";
    }

    public class CatalogoService
    {
        private readonly DBContext _dbContext;
        private readonly ILogger<CatalogoService> _logger;

        public CatalogoService(DBContext dbContext, ILogger<CatalogoService> logger)
        {
            _dbContext = dbContext;
            _logger = logger;
        }

        public async Task<List<ProductoDto>> ListarProductosAsync(long idSitio, long? idCategoria = null, string soloActivos = "S")
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CATALOGO.SP_LISTAR_PRODUCTOS", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_SITIO", OracleDbType.Int64).Value = idSitio;
                command.Parameters.Add("P_ID_CATEGORIA", OracleDbType.Int64).Value =
                    (object?)idCategoria ?? DBNull.Value;
                command.Parameters.Add("P_SOLO_ACTIVOS", OracleDbType.Char).Value = soloActivos;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var productos = new List<ProductoDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    productos.Add(new ProductoDto
                    {
                        IdProducto = reader.GetInt64(reader.GetOrdinal("ID_PRODUCTO")),
                        IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                        IdCategoria = reader.GetInt64(reader.GetOrdinal("ID_CATEGORIA")),
                        Categoria = reader.GetString(reader.GetOrdinal("CATEGORIA")),
                        IdArchivoImagen = reader.IsDBNull(reader.GetOrdinal("ID_ARCHIVO_IMAGEN")) ? null : reader.GetInt64(reader.GetOrdinal("ID_ARCHIVO_IMAGEN")),
                        Sku = reader.GetString(reader.GetOrdinal("SKU")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        Descripcion = reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                        PrecioBase = reader.GetDecimal(reader.GetOrdinal("PRECIO_BASE")),
                        PermiteLadoA = reader.GetString(reader.GetOrdinal("PERMITE_LADO_A")),
                        PermiteLadoB = reader.GetString(reader.GetOrdinal("PERMITE_LADO_B")),
                        Activo = reader.GetString(reader.GetOrdinal("ACTIVO")),
                    });
                }
                return productos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando productos");
                return new List<ProductoDto>();
            }
        }

        public async Task<ProductoDto?> ObtenerProductoAsync(long idProducto)
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CATALOGO.SP_OBTENER_PRODUCTO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_PRODUCTO", OracleDbType.Int64).Value = idProducto;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                using var reader = await command.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new ProductoDto
                    {
                        IdProducto = reader.GetInt64(reader.GetOrdinal("ID_PRODUCTO")),
                        IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                        IdCategoria = reader.GetInt64(reader.GetOrdinal("ID_CATEGORIA")),
                        Categoria = reader.GetString(reader.GetOrdinal("CATEGORIA")),
                        IdArchivoImagen = reader.IsDBNull(reader.GetOrdinal("ID_ARCHIVO_IMAGEN")) ? null : reader.GetInt64(reader.GetOrdinal("ID_ARCHIVO_IMAGEN")),
                        Sku = reader.GetString(reader.GetOrdinal("SKU")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        Descripcion = reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                        PrecioBase = reader.GetDecimal(reader.GetOrdinal("PRECIO_BASE")),
                        PermiteLadoA = reader.GetString(reader.GetOrdinal("PERMITE_LADO_A")),
                        PermiteLadoB = reader.GetString(reader.GetOrdinal("PERMITE_LADO_B")),
                        Activo = reader.GetString(reader.GetOrdinal("ACTIVO")),
                    };
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo producto {Id}", idProducto);
                return null;
            }
        }

        public async Task<long> CrearProductoAsync(long idSitio, long idCategoria, long? idArchivoImagen, string sku, string nombre, string descripcion, decimal precioBase, string permiteLadoA, string permiteLadoB)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CATALOGO.SP_CREAR_PRODUCTO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_SITIO", OracleDbType.Int64).Value = idSitio;
            command.Parameters.Add("P_ID_CATEGORIA", OracleDbType.Int64).Value = idCategoria;
            command.Parameters.Add("P_ID_ARCHIVO_IMAGEN", OracleDbType.Int64).Value =
                (object?)idArchivoImagen ?? DBNull.Value;
            command.Parameters.Add("P_SKU", OracleDbType.Varchar2).Value = sku;
            command.Parameters.Add("P_NOMBRE", OracleDbType.Varchar2).Value = nombre;
            command.Parameters.Add("P_DESCRIPCION", OracleDbType.Varchar2).Value = descripcion;
            command.Parameters.Add("P_PRECIO_BASE", OracleDbType.Decimal).Value = precioBase;
            command.Parameters.Add("P_PERMITE_LADO_A", OracleDbType.Char).Value = permiteLadoA;
            command.Parameters.Add("P_PERMITE_LADO_B", OracleDbType.Char).Value = permiteLadoB;

            var oId = new OracleParameter("O_ID_PRODUCTO", OracleDbType.Int64) { Direction = ParameterDirection.Output };
            command.Parameters.Add(oId);

            await command.ExecuteNonQueryAsync();
            return ((OracleDecimal)oId.Value).ToInt64();
        }

        public async Task ActualizarProductoAsync(long idProducto, long idCategoria, long? idArchivoImagen, string nombre, string descripcion, decimal precioBase, string permiteLadoA, string permiteLadoB)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CATALOGO.SP_ACTUALIZAR_PRODUCTO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_PRODUCTO", OracleDbType.Int64).Value = idProducto;
            command.Parameters.Add("P_ID_CATEGORIA", OracleDbType.Int64).Value = idCategoria;
            command.Parameters.Add("P_ID_ARCHIVO_IMAGEN", OracleDbType.Int64).Value =
                (object?)idArchivoImagen ?? DBNull.Value;
            command.Parameters.Add("P_NOMBRE", OracleDbType.Varchar2).Value = nombre;
            command.Parameters.Add("P_DESCRIPCION", OracleDbType.Varchar2).Value = descripcion;
            command.Parameters.Add("P_PRECIO_BASE", OracleDbType.Decimal).Value = precioBase;
            command.Parameters.Add("P_PERMITE_LADO_A", OracleDbType.Char).Value = permiteLadoA;
            command.Parameters.Add("P_PERMITE_LADO_B", OracleDbType.Char).Value = permiteLadoB;

            await command.ExecuteNonQueryAsync();
        }

        public async Task CambiarEstadoProductoAsync(long idProducto, string activo)
        {
            using var connection = _dbContext.CreateConnection();
            await _dbContext.OpenConnectionAsync(connection);

            using var command = new OracleCommand("PKG_CATALOGO.SP_CAMBIAR_ESTADO_PRODUCTO", connection);
            command.CommandType = CommandType.StoredProcedure;

            command.Parameters.Add("P_ID_PRODUCTO", OracleDbType.Int64).Value = idProducto;
            command.Parameters.Add("P_ACTIVO", OracleDbType.Char).Value = activo;

            await command.ExecuteNonQueryAsync();
        }

        public async Task<List<CategoriaDto>> ListarCategoriasAsync(string soloActivas = "S")
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CATALOGO.SP_LISTAR_CATEGORIAS", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_SOLO_ACTIVAS", OracleDbType.Char).Value = soloActivas;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var categorias = new List<CategoriaDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    categorias.Add(new CategoriaDto
                    {
                        IdCategoria = reader.GetInt64(reader.GetOrdinal("ID_CATEGORIA")),
                        Codigo = reader.GetString(reader.GetOrdinal("CODIGO")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        Descripcion = reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                    });
                }
                return categorias;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando categorías");
                return new List<CategoriaDto>();
            }
        }

        public async Task<List<AreaEntregaDto>> ListarAreasEntregaAsync(long idSitio, string soloActivas = "S")
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CATALOGO.SP_LISTAR_AREAS_ENTREGA", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_ID_SITIO", OracleDbType.Int64).Value = idSitio;
                command.Parameters.Add("P_SOLO_ACTIVAS", OracleDbType.Char).Value = soloActivas;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var areas = new List<AreaEntregaDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    areas.Add(new AreaEntregaDto
                    {
                        IdAreaEntrega = reader.GetInt64(reader.GetOrdinal("ID_AREA_ENTREGA")),
                        IdSitio = reader.GetInt64(reader.GetOrdinal("ID_SITIO")),
                        Codigo = reader.GetString(reader.GetOrdinal("CODIGO")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        TipoArea = reader.GetString(reader.GetOrdinal("TIPO_AREA")),
                        Referencia = reader.GetString(reader.GetOrdinal("REFERENCIA")),
                        CargoEntrega = reader.GetDecimal(reader.GetOrdinal("CARGO_ENTREGA")),
                    });
                }
                return areas;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando áreas de entrega");
                return new List<AreaEntregaDto>();
            }
        }

        public async Task<List<MetodoPagoDto>> ListarMetodosPagoAsync(string soloActivos = "S")
        {
            try
            {
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);

                using var command = new OracleCommand("PKG_CATALOGO.SP_LISTAR_METODOS_PAGO", connection);
                command.CommandType = CommandType.StoredProcedure;

                command.Parameters.Add("P_SOLO_ACTIVOS", OracleDbType.Char).Value = soloActivos;
                command.Parameters.Add("O_DATOS", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                var metodos = new List<MetodoPagoDto>();
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    metodos.Add(new MetodoPagoDto
                    {
                        IdMetodoPago = reader.GetInt64(reader.GetOrdinal("ID_METODO_PAGO")),
                        Codigo = reader.GetString(reader.GetOrdinal("CODIGO")),
                        Nombre = reader.GetString(reader.GetOrdinal("NOMBRE")),
                        RequiereProveedor = reader.GetString(reader.GetOrdinal("REQUIERE_PROVEEDOR")),
                    });
                }
                return metodos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listando métodos de pago");
                return new List<MetodoPagoDto>();
            }
        }
    }
}
