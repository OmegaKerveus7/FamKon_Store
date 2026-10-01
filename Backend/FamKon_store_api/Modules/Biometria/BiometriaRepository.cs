using System.Data;
using System.Security.Cryptography;
using FamKon_store_api.BD;
using FamKon_store_api.Models;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;

namespace FamKon_store_api.Modules.Biometria;

public sealed record UsuarioBiometrico(Usuario Usuario, long? FotoOriginal, long? FotoSegmentada);

public interface IBiometriaRepository
{
    Task<UsuarioBiometrico?> BuscarAsync(string? identificador, long? id, CancellationToken ct);
    Task<IReadOnlyList<UsuarioBiometrico>> ListarReferenciasAsync(int limite, CancellationToken ct);
    Task<byte[]?> FotoAsync(long id, long idUsuario, CancellationToken ct);
    Task GuardarAsync(UsuarioBiometrico usuario, byte[] original, byte[] segmentada, CancellationToken ct);
}

public sealed class BiometriaRepository(DBContext db) : IBiometriaRepository
{
    public async Task<UsuarioBiometrico?> BuscarAsync(string? identificador, long? id, CancellationToken ct)
    {
        using var connection = db.CreateConnection();
        await connection.OpenAsync(ct);
        using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandText = """
            SELECT U.ID_USUARIO, U.CORREO, U.NICKNAME, U.TELEFONO, U.FECHA_NACIMIENTO,
                   U.ACTIVO, U.BLOQUEADO, U.ID_FOTO_ORIGINAL, U.ID_FOTO_MODIFICADA,
                   (SELECT LISTAGG(R.CODIGO, ',') WITHIN GROUP (ORDER BY R.CODIGO)
                      FROM USUARIO_ROL UR JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                     WHERE UR.ID_USUARIO = U.ID_USUARIO AND R.ACTIVO = 'S') AS ROLES
              FROM USUARIO U WHERE
            """ + " " + (id.HasValue ? "U.ID_USUARIO = :id" : "(LOWER(TRIM(U.CORREO)) = :identificador OR LOWER(TRIM(U.NICKNAME)) = :identificador)");
        if (id.HasValue) command.Parameters.Add("id", OracleDbType.Int64).Value = id.Value;
        else command.Parameters.Add("identificador", OracleDbType.Varchar2).Value = identificador!.Trim().ToLowerInvariant();
        using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        string Texto(string nombre) => reader.IsDBNull(reader.GetOrdinal(nombre)) ? "" : reader.GetString(reader.GetOrdinal(nombre));
        long? Numero(string nombre) => reader.IsDBNull(reader.GetOrdinal(nombre)) ? null : reader.GetInt64(reader.GetOrdinal(nombre));
        var resultado = new UsuarioBiometrico(new Usuario {
            IdUsuario = reader.GetInt64(0), Correo = Texto("CORREO"), Nickname = Texto("NICKNAME"),
            Telefono = Texto("TELEFONO"), Activo = Texto("ACTIVO"), Bloqueado = Texto("BLOQUEADO"), Roles = Texto("ROLES"),
            FechaNacimiento = reader.IsDBNull(4) ? null : reader.GetDateTime(4)
        }, Numero("ID_FOTO_ORIGINAL"), Numero("ID_FOTO_MODIFICADA"));
        if (await reader.ReadAsync(ct))
            throw new BiometriaException("BIO_IDENTIFICADOR_AMBIGUO", "Utiliza el correo de tu cuenta para identificarte.", 409);
        return resultado;
    }

    public async Task<IReadOnlyList<UsuarioBiometrico>> ListarReferenciasAsync(int limite, CancellationToken ct)
    {
        using var connection = db.CreateConnection();
        await connection.OpenAsync(ct);
        using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandText = """
            SELECT ID_USUARIO, ID_FOTO_ORIGINAL, ID_FOTO_MODIFICADA FROM USUARIO
             WHERE ACTIVO = 'S' AND BLOQUEADO = 'N'
               AND (ID_FOTO_ORIGINAL IS NOT NULL OR ID_FOTO_MODIFICADA IS NOT NULL)
             ORDER BY ID_USUARIO FETCH FIRST :limite ROWS ONLY
            """;
        command.Parameters.Add("limite", OracleDbType.Int32).Value = limite;
        using var reader = await command.ExecuteReaderAsync(ct);
        var usuarios = new List<UsuarioBiometrico>();
        while (await reader.ReadAsync(ct))
            usuarios.Add(new(new Usuario { IdUsuario = reader.GetInt64(0) },
                reader.IsDBNull(1) ? null : reader.GetInt64(1), reader.IsDBNull(2) ? null : reader.GetInt64(2)));
        return usuarios;
    }

    public async Task<byte[]?> FotoAsync(long id, long idUsuario, CancellationToken ct)
    {
        using var connection = db.CreateConnection();
        await connection.OpenAsync(ct);
        using var command = connection.CreateCommand();
        command.BindByName = true;
        command.CommandText = """
            SELECT A.CONTENIDO FROM ARCHIVO A JOIN USUARIO U
              ON A.ID_ARCHIVO IN (U.ID_FOTO_ORIGINAL, U.ID_FOTO_MODIFICADA)
             WHERE U.ID_USUARIO = :usuario AND A.ID_ARCHIVO = :id AND A.ACTIVO = 'S'
            """;
        command.Parameters.Add("usuario", OracleDbType.Int64).Value = idUsuario;
        command.Parameters.Add("id", OracleDbType.Int64).Value = id;
        using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct) || reader.IsDBNull(0)) return null;
        using var blob = reader.GetOracleBlob(0);
        if (blob.Length > 5 * 1024 * 1024) throw new BiometriaException("BIO_REFERENCIA_INVALIDA", "La foto guardada excede el tamaño permitido.", 409);
        return blob.Value;
    }

    public async Task GuardarAsync(UsuarioBiometrico usuario, byte[] original, byte[] segmentada, CancellationToken ct)
    {
        using var connection = db.CreateConnection();
        await connection.OpenAsync(ct);
        using var transaction = connection.BeginTransaction();
        // Ambas imágenes y su asociación al usuario se confirman juntas.
        async Task<long> Archivo(byte[] bytes, string tipo)
        {
            using var command = new OracleCommand("PKG_ARCHIVO.SP_GUARDAR_ARCHIVO", connection) {
                Transaction = transaction, CommandType = CommandType.StoredProcedure, BindByName = true
            };
            command.Parameters.Add("P_ID_USUARIO_CARGA", OracleDbType.Int64).Value = usuario.Usuario.IdUsuario;
            command.Parameters.Add("P_TIPO_ARCHIVO", OracleDbType.Varchar2).Value = tipo;
            command.Parameters.Add("P_NOMBRE_ARCHIVO", OracleDbType.Varchar2).Value = $"biometria_{Guid.NewGuid():N}";
            command.Parameters.Add("P_MIME_TYPE", OracleDbType.Varchar2).Value = ImagenBiometrica.Mime(bytes)!;
            command.Parameters.Add("P_HASH_SHA256", OracleDbType.Varchar2).Value = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            command.Parameters.Add("P_CONTENIDO", OracleDbType.Blob).Value = bytes;
            var salida = command.Parameters.Add("O_ID_ARCHIVO", OracleDbType.Int64);
            salida.Direction = ParameterDirection.Output;
            await command.ExecuteNonQueryAsync(ct);
            return ((OracleDecimal)salida.Value).ToInt64();
        }
        var originalId = await Archivo(original, "FOTO_USUARIO_ORIGINAL");
        var segmentadaId = await Archivo(segmentada, "FOTO_USUARIO_MODIFICADA");
        using var update = connection.CreateCommand();
        update.Transaction = transaction;
        update.BindByName = true;
        update.CommandText = """
            UPDATE USUARIO SET ID_FOTO_ORIGINAL = :original, ID_FOTO_MODIFICADA = :segmentada
             WHERE ID_USUARIO = :id AND ACTIVO = 'S' AND BLOQUEADO = 'N'
               AND NVL(ID_FOTO_ORIGINAL, -1) = :anteriorOriginal
               AND NVL(ID_FOTO_MODIFICADA, -1) = :anteriorSegmentada
            """;
        update.Parameters.Add("original", OracleDbType.Int64).Value = originalId;
        update.Parameters.Add("segmentada", OracleDbType.Int64).Value = segmentadaId;
        update.Parameters.Add("id", OracleDbType.Int64).Value = usuario.Usuario.IdUsuario;
        update.Parameters.Add("anteriorOriginal", OracleDbType.Int64).Value = usuario.FotoOriginal ?? -1;
        update.Parameters.Add("anteriorSegmentada", OracleDbType.Int64).Value = usuario.FotoSegmentada ?? -1;
        if (await update.ExecuteNonQueryAsync(ct) != 1)
            throw new BiometriaException("BIO_CUENTA_CAMBIO", "La cuenta cambió durante la operación. Intenta de nuevo.", 409);
        transaction.Commit();
    }
}
