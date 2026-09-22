using FamKon_store_api.BD;
using Microsoft.Extensions.Configuration;
using Oracle.ManagedDataAccess.Client;
using System.Text.RegularExpressions;

if (args.Length != 2 || args[0] is not ("query" or "apply"))
    throw new ArgumentException("Uso: dotnet run --project tools/OracleRunner -- query|apply archivo.sql (desde la raíz del repositorio)");
var config = new ConfigurationBuilder().AddJsonFile(Path.GetFullPath("Backend/FamKon_store_api/appsettings.json")).Build();
using var connection = new DBContext(config).CreateConnection();
await connection.OpenAsync();
var sql = await File.ReadAllTextAsync(args[1]);
if (args[0] == "query") {
    using var cmd = new OracleCommand(sql.Trim().TrimEnd(';'), connection);
    using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync()) Console.WriteLine(string.Join(" | ", Enumerable.Range(0,reader.FieldCount).Select(i => reader.IsDBNull(i) ? "NULL" : reader.GetValue(i).ToString())));
} else {
    // Los scripts de migración delimitan TODAS las unidades con / en línea propia.
    int n = 0;
    foreach (var part in Regex.Split(sql, @"^\s*/\s*$", RegexOptions.Multiline)) {
        var unit = part.Trim();
        if (unit.Length == 0) continue;
        if (!Regex.IsMatch(unit, @"^(DECLARE|BEGIN|CREATE\s+OR\s+REPLACE\s+(PACKAGE|TRIGGER|PROCEDURE|FUNCTION))\b", RegexOptions.IgnoreCase)) unit=unit.TrimEnd(';');
        using var cmd = new OracleCommand(unit, connection) { CommandTimeout = 120 };
        await cmd.ExecuteNonQueryAsync();
        Console.WriteLine($"Unidad {++n}: OK");
    }
    using var errors = new OracleCommand("SELECT NAME, LINE, POSITION, TEXT FROM USER_ERRORS WHERE NAME IN ('PKG_COMPRA','TR_FK_PAGO_AUDIT') ORDER BY NAME,SEQUENCE",connection);
    using var r = await errors.ExecuteReaderAsync();
    bool failed=false;
    while(await r.ReadAsync()) { failed=true; Console.WriteLine($"{r.GetString(0)}:{r.GetValue(1)}:{r.GetValue(2)} {r.GetString(3)}"); }
    if(failed) Environment.Exit(1);
}
