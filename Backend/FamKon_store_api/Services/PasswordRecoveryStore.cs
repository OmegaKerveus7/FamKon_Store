using System.Text.Json;
using FamKon_store_api.BD;
using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.Services;

public sealed record PasswordAccount(long Id, string Correo, string Telefono, string Hash, bool Habilitado);

// Una fila por cuenta conserva también los límites de intentos entre reinicios.
public sealed class PasswordRecoveryState
{
    public string? Solicitud { get; set; }
    public string? SecretoHash { get; set; }
    public string? PasswordAnteriorHash { get; set; }
    public string Etapa { get; set; } = "CERRADA";
    public DateTimeOffset Expira { get; set; }
    public DateTimeOffset UltimoEnvio { get; set; }
    public DateTimeOffset VentanaEnvios { get; set; }
    public int Envios { get; set; }
    public int Intentos { get; set; }
    public DateTimeOffset VentanaCambios { get; set; }
    public int IntentosCambio { get; set; }

    public void Cerrar()
    {
        Etapa = "CERRADA";
        SecretoHash = null;
        PasswordAnteriorHash = null;
    }
}

public interface IPasswordRecoverySession : IDisposable
{
    PasswordAccount Account { get; }
    PasswordRecoveryState State { get; }
    Task Commit(string? nuevoHash = null);
}

public interface IPasswordRecoveryStore
{
    Task<IPasswordRecoverySession?> Open(string? identificador = null, long? usuario = null, string? solicitud = null);
}

public sealed class PasswordRecoveryStore(DBContext db) : IPasswordRecoveryStore
{
    public async Task<IPasswordRecoverySession?> Open(string? identificador = null, long? usuario = null, string? solicitud = null)
    {
        var connection = db.CreateConnection();
        try
        {
            await db.OpenConnectionAsync(connection);
            var transaction = connection.BeginTransaction();
            try
            {
                // Siempre bloquear primero USUARIO: solicitudes, validaciones y cambios se serializan.
                var where = usuario.HasValue ? "ID_USUARIO=:valor" : solicitud is not null
                    ? "ID_USUARIO=(SELECT ID_USUARIO FROM RECUPERACION_PASSWORD WHERE SOLICITUD=:valor)"
                    : "(LOWER(CORREO)=LOWER(:valor) OR LOWER(NICKNAME)=LOWER(:valor))";
                using var cmd = new OracleCommand($"SELECT ID_USUARIO,CORREO,TELEFONO,PASSWORD_HASH,ACTIVO,BLOQUEADO FROM USUARIO WHERE {where} FOR UPDATE", connection) { BindByName = true, Transaction = transaction };
                cmd.Parameters.Add("valor", usuario.HasValue ? OracleDbType.Int64 : OracleDbType.Varchar2).Value = (object?)usuario ?? solicitud ?? identificador ?? "";
                PasswordAccount account;
                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (!await reader.ReadAsync()) { transaction.Dispose(); connection.Dispose(); return null; }
                    account = new(reader.GetInt64(0), reader.GetString(1), reader.IsDBNull(2) ? "" : reader.GetString(2), reader.GetString(3), reader.GetString(4) == "S" && reader.GetString(5) == "N");
                    // No escoger arbitrariamente si un nickname coincide con el correo de otra cuenta.
                    if (await reader.ReadAsync()) { transaction.Dispose(); connection.Dispose(); return null; }
                }
                using var stateCmd = new OracleCommand("SELECT ESTADO FROM RECUPERACION_PASSWORD WHERE ID_USUARIO=:id", connection) { Transaction = transaction };
                stateCmd.Parameters.Add("id", OracleDbType.Int64).Value = account.Id;
                using var stateReader = await stateCmd.ExecuteReaderAsync();
                var state = await stateReader.ReadAsync()
                    ? JsonSerializer.Deserialize<PasswordRecoveryState>(stateReader.GetString(0))!
                    : new PasswordRecoveryState();
                return new Session(connection, transaction, account, state);
            }
            catch { transaction.Dispose(); throw; }
        }
        catch { connection.Dispose(); throw; }
    }

    private sealed class Session(OracleConnection connection, OracleTransaction transaction, PasswordAccount account, PasswordRecoveryState state) : IPasswordRecoverySession
    {
        public PasswordAccount Account => account;
        public PasswordRecoveryState State => state;

        public async Task Commit(string? nuevoHash = null)
        {
            if (nuevoHash is not null)
            {
                using var change = new OracleCommand("UPDATE USUARIO SET PASSWORD_HASH=:hash, FECHA_MODIFICACION=SYSTIMESTAMP WHERE ID_USUARIO=:id", connection) { BindByName = true, Transaction = transaction };
                change.Parameters.Add("hash", OracleDbType.Varchar2).Value = nuevoHash;
                change.Parameters.Add("id", OracleDbType.Int64).Value = account.Id;
                await change.ExecuteNonQueryAsync();
                // Invalidar también tokens emitidos por los procedimientos anteriores.
                using var invalidate = new OracleCommand("UPDATE TOKEN_RECUPERACION SET UTILIZADO='S', FECHA_USO=SYSTIMESTAMP WHERE ID_USUARIO=:id AND UTILIZADO='N'", connection) { Transaction = transaction };
                invalidate.Parameters.Add("id", OracleDbType.Int64).Value = account.Id;
                await invalidate.ExecuteNonQueryAsync();
            }
            using var save = new OracleCommand("""
                MERGE INTO RECUPERACION_PASSWORD r USING (SELECT :id ID_USUARIO FROM DUAL) u
                ON (r.ID_USUARIO=u.ID_USUARIO)
                WHEN MATCHED THEN UPDATE SET r.SOLICITUD=:solicitud, r.ESTADO=:estado
                WHEN NOT MATCHED THEN INSERT (ID_USUARIO,SOLICITUD,ESTADO) VALUES (u.ID_USUARIO,:solicitud,:estado)
                """, connection) { BindByName = true, Transaction = transaction };
            save.Parameters.Add("id", OracleDbType.Int64).Value = account.Id;
            save.Parameters.Add("solicitud", OracleDbType.Varchar2).Value = (object?)state.Solicitud ?? DBNull.Value;
            save.Parameters.Add("estado", OracleDbType.Clob).Value = JsonSerializer.Serialize(state);
            await save.ExecuteNonQueryAsync();
            transaction.Commit();
        }

        public void Dispose() { transaction.Dispose(); connection.Dispose(); }
    }
}
