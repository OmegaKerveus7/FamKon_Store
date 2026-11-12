using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oracle.ManagedDataAccess.Client;
namespace FamKon_store_api.Controllers;

[ApiController, Authorize, Route("api/famkon/notificaciones")]
public class NotificacionesController(CompraService compras, PermisoService permisos, ILogger<NotificacionesController> logger) : ControllerBase
{
    private static readonly string[] PermisosValidos = ["VER_TRACKING", "VER_PEDIDOS_ASIGNADOS", "GESTIONAR_ENTREGAS"];

    private long Actor => long.Parse(User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
    private async Task<bool> Permitido() => (await permisos.ListarPermisosAsync(Actor)).Any(p => PermisosValidos.Contains(p.CodigoPermiso));

    [HttpGet]
    public async Task<IActionResult> Listar() {
        if (!await Permitido()) return Forbid();
        try {
            return Ok(await ConsultarAsync(conLectura: true));
        } catch (OracleException ex) when (ex.Number == 942) {
            // La tabla de lectura es opcional (migracion 14). Sin ella se muestran
            // los avisos del pedido, todos como no leidos, en lugar de fallar.
            logger.LogWarning(ex, "NOTIFICACION_LECTURA no existe; se listan los avisos sin estado de lectura");
            try {
                return Ok(await ConsultarAsync(conLectura: false));
            } catch (OracleException inner) {
                logger.LogError(inner, "Error consultando notificaciones");
                return StatusCode(503, new { mensaje = "No se pudieron cargar tus notificaciones. Intenta nuevamente más tarde." });
            }
        } catch (OracleException ex) {
            logger.LogError(ex, "Error consultando notificaciones");
            return StatusCode(503, new { mensaje = "No se pudieron cargar tus notificaciones. Intenta nuevamente más tarde." });
        }
    }

    private async Task<object> ConsultarAsync(bool conLectura) {
        using var c = await compras.Abrir(Actor);
        const string baseOrigen = " FROM PEDIDO_ESTADO_HISTORIAL H JOIN PEDIDO P ON P.ID_PEDIDO=H.ID_PEDIDO";
        var origen = conLectura
            ? baseOrigen + " LEFT JOIN NOTIFICACION_LECTURA L ON L.ID_USUARIO=P.ID_USUARIO AND L.ID_HISTORIAL=H.ID_HISTORIAL WHERE P.ID_USUARIO=:actor"
            : baseOrigen + " WHERE P.ID_USUARIO=:actor";

        var noLeidas = 0;
        if (conLectura) {
            using var count = CompraService.Comando(c, "SELECT COUNT(*)" + origen + " AND L.ID_HISTORIAL IS NULL", ("actor", Actor));
            noLeidas = Convert.ToInt32(await count.ExecuteScalarAsync());
        } else {
            using var count = CompraService.Comando(c, "SELECT COUNT(*)" + origen, ("actor", Actor));
            noLeidas = Convert.ToInt32(await count.ExecuteScalarAsync());
        }

        var leidaSql = conLectura ? "CASE WHEN L.ID_HISTORIAL IS NULL THEN 0 ELSE 1 END" : "0";
        using var cmd = CompraService.Comando(c,
            "SELECT H.ID_HISTORIAL,P.ID_PEDIDO,P.NUMERO_PEDIDO,(SELECT NOMBRE FROM ESTADO_PEDIDO E WHERE E.ID_ESTADO_PEDIDO=H.ID_ESTADO_PEDIDO),H.COMENTARIO,TO_CHAR(H.FECHA_ESTADO,'YYYY-MM-DD\"T\"HH24:MI:SS.FF3TZH:TZM')," + leidaSql
            + origen + " ORDER BY H.FECHA_ESTADO DESC,H.ID_HISTORIAL DESC FETCH NEXT 30 ROWS ONLY", ("actor", Actor));
        using var r = await cmd.ExecuteReaderAsync();
        var items = new List<object>();
        while (await r.ReadAsync()) {
            string S(int i) => r.IsDBNull(i) ? "" : r.GetString(i);
            items.Add(new { id = r.GetInt64(0), idPedido = r.GetInt64(1), numeroPedido = S(2), estado = S(3), mensaje = S(4), fecha = S(5), leida = r.GetInt32(6) == 1 });
        }
        return new { items, noLeidas };
    }

    [HttpPut("{id:long}/leida")]
    public async Task<IActionResult> Leer(long id) {
        if (!await Permitido()) return Forbid();
        try {
            using var c = await compras.Abrir(Actor);
            using var cmd = CompraService.Comando(c, "INSERT INTO NOTIFICACION_LECTURA(ID_USUARIO,ID_HISTORIAL) SELECT :actor,H.ID_HISTORIAL FROM PEDIDO_ESTADO_HISTORIAL H JOIN PEDIDO P ON P.ID_PEDIDO=H.ID_PEDIDO WHERE H.ID_HISTORIAL=:id AND P.ID_USUARIO=:actor AND NOT EXISTS (SELECT 1 FROM NOTIFICACION_LECTURA L WHERE L.ID_USUARIO=:actor AND L.ID_HISTORIAL=H.ID_HISTORIAL)", ("actor", Actor), ("id", id));
            await cmd.ExecuteNonQueryAsync();
        } catch (OracleException ex) when (ex.Number is 1 or 942) {
            // 1 = ya estaba leida; 942 = falta la migracion de notificaciones.
        }
        return Ok(new { leida = true });
    }
}
