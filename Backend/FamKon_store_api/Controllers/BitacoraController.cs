using FamKon_store_api.BD;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.Controllers;

[ApiController, Authorize, Route("api/famkon/admin/bitacora")]
public class BitacoraController(DBContext db, PermisoService permisos, ILogger<BitacoraController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] int pagina = 1, [FromQuery] string? resultado = null,
        [FromQuery] string? metodo = null, [FromQuery] string? busqueda = null, CancellationToken cancellationToken = default)
    {
        var claim = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!long.TryParse(claim, out var actor) || !(await permisos.ListarPermisosAsync(actor)).Any(p => p.CodigoPermiso == "GESTIONAR_USUARIOS")) return Forbid();
        if (pagina < 1 || pagina > 100000 || (resultado != null && resultado is not ("S" or "N")) ||
            (metodo != null && metodo is not ("CONTRASENA" or "QR" or "FACIAL")) || busqueda?.Length > 150) return BadRequest(new { mensaje = "Filtros de bitácora no válidos." });
        const string filtro = " FROM BITACORA_ACCESO B LEFT JOIN USUARIO U ON U.ID_USUARIO=B.ID_USUARIO WHERE (:resultado IS NULL OR B.RESULTADO=:resultado) AND (:metodo IS NULL OR B.METODO_ACCESO=:metodo) AND (:buscar IS NULL OR INSTR(LOWER(NVL(U.NICKNAME,B.IDENTIFICADOR)),:buscar)>0 OR INSTR(LOWER(B.DIRECCION_IP),:buscar)>0 OR INSTR(LOWER(B.MOTIVO),:buscar)>0)";
        void Parametros(OracleCommand cmd) {
            cmd.BindByName = true; cmd.CommandTimeout = 20;
            cmd.Parameters.Add("resultado", OracleDbType.Varchar2).Value = (object?)resultado ?? DBNull.Value;
            cmd.Parameters.Add("metodo", OracleDbType.Varchar2).Value = (object?)metodo ?? DBNull.Value;
            cmd.Parameters.Add("buscar", OracleDbType.Varchar2).Value = string.IsNullOrWhiteSpace(busqueda) ? DBNull.Value : busqueda.Trim().ToLowerInvariant();
        }
        try {
            using var c = db.CreateConnection(); await c.OpenAsync(cancellationToken);
            using var count = new OracleCommand("SELECT COUNT(*)" + filtro, c); Parametros(count);
            var total = Convert.ToInt64(await count.ExecuteScalarAsync(cancellationToken));
            using var cmd = new OracleCommand("SELECT B.ID_BITACORA, TO_CHAR(B.FECHA_EVENTO AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), NVL(U.NICKNAME,NVL(B.IDENTIFICADOR,'Sin identificar')), B.METODO_ACCESO,B.RESULTADO,B.DIRECCION_IP,B.MOTIVO" + filtro + " ORDER BY B.FECHA_EVENTO DESC,B.ID_BITACORA DESC OFFSET :inicio ROWS FETCH NEXT 25 ROWS ONLY", c);
            Parametros(cmd); cmd.Parameters.Add("inicio", OracleDbType.Int32).Value = (pagina - 1) * 25;
            using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            var eventos = new List<object>();
            while (await reader.ReadAsync(cancellationToken)) {
                string Texto(int i) => reader.IsDBNull(i) ? "" : reader.GetString(i);
                eventos.Add(new { id = reader.GetInt64(0), fecha = Texto(1), usuario = Texto(2), metodo = Texto(3), resultado = Texto(4), ip = Texto(5), motivo = Texto(6) });
            }
            return Ok(new { eventos, total, pagina, tamanoPagina = 25 });
        } catch (OracleException ex) {
            logger.LogError(ex, "Error consultando bitácora de accesos");
            return StatusCode(503, new { mensaje = "No se pudo consultar la bitácora. Verifica la conexión a la base de datos e intenta nuevamente." });
        }
    }
}
