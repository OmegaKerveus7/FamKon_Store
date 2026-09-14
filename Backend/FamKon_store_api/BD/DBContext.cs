using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.BD
{
    public class DBContext
    {
        private readonly string _connectionString;

        public DBContext(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("Oracle")!;
        }

        public OracleConnection CreateConnection()
        {
            return new OracleConnection(_connectionString);
        }

        public async Task OpenConnectionAsync(OracleConnection connection)
        {
            await connection.OpenAsync();
        }
    }
}
