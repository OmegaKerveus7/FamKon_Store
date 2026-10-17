using System.Text.RegularExpressions;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace FamKon_store_api.Controllers;

[ApiController, Route("api/famkon/rastreo"), ServiceFilter(typeof(CompraExceptionFilter))]
public class RastreoController(CompraService compras) : ControllerBase
{
    [AllowAnonymous, HttpGet, EnableRateLimiting("rastreo")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Consultar([FromQuery] string? guia, [FromQuery] long? pedido)
    {
        guia = guia?.Trim().ToUpperInvariant();
        var porGuia = !string.IsNullOrEmpty(guia);
        if (porGuia ? !Regex.IsMatch(guia!, @"\AFK-[A-Z0-9]{20,64}\z") : pedido is null or <= 0)
            return NotFound(new { mensaje = "No encontramos esa guía. Revisá el número completo de tu comprobante." });
        // Old receipts identify an order by ID. Both lookups expose only progress, never purchase details.
        using var c = await compras.Abrir();
        var filtro = porGuia ? "P.NUMERO_PEDIDO=:guia" : "P.ID_PEDIDO=:pedido";
        (string, object?) parametro = porGuia ? ("guia", guia) : ("pedido", pedido);
        using var cmd = CompraService.Comando(c, $"""
            SELECT P.ID_PEDIDO, P.ID_MODALIDAD_ENTREGA, E.CODIGO ESTADO, E.NOMBRE
            FROM PEDIDO P JOIN ESTADO_PEDIDO E ON E.ID_ESTADO_PEDIDO=P.ID_ESTADO_PEDIDO
            WHERE {filtro}
            """, parametro);
        var fila = (await CompraService.Leer(cmd)).FirstOrDefault();
        if (fila is null) return NotFound(new { mensaje = "No encontramos esa guía. Revisá el número completo de tu comprobante." });
        using var historia = CompraService.Comando(c, """
            SELECT E.CODIGO ESTADO, E.NOMBRE,
                   TO_CHAR(H.FECHA_ESTADO,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA
            FROM PEDIDO_ESTADO_HISTORIAL H
            JOIN ESTADO_PEDIDO E ON E.ID_ESTADO_PEDIDO=H.ID_ESTADO_PEDIDO
            WHERE H.ID_PEDIDO=:pedido ORDER BY H.FECHA_ESTADO DESC,H.ID_HISTORIAL DESC
            """, ("pedido", fila["idPedido"]));
        // Explicit public projection: no customer, amount, address, products, notes or private links.
        return Ok(new { numeroPedido = porGuia ? guia : null,
            estado = fila["estado"], nombre = fila["nombre"],
            idModalidadEntrega = fila["idModalidadEntrega"], historial = await CompraService.Leer(historia) });
    }
    [Authorize, HttpGet("detalle"), EnableRateLimiting("rastreo")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> ResolverDetalle([FromQuery] string? guia, [FromQuery] long? pedido, [FromQuery] string vista = "cliente")
    {
        if (!long.TryParse(User.FindFirst("sub")?.Value, out var actor)) return Unauthorized();
        if (vista is not ("cliente" or "admin" or "repartidor")) return BadRequest();
        guia = guia?.Trim().ToUpperInvariant();
        var porGuia = !string.IsNullOrEmpty(guia);
        if (porGuia ? !Regex.IsMatch(guia!, @"\AFK-[A-Z0-9]{20,64}\z") : pedido is null or <= 0) return NotFound();
        using var c = await compras.Abrir(actor);
        var filtro = porGuia ? "NUMERO_PEDIDO=:guia" : "ID_PEDIDO=:pedido";
        (string, object?) parametro = porGuia ? ("guia", guia) : ("pedido", pedido);
        using var cmd = CompraService.Comando(c, $"SELECT ID_PEDIDO FROM PEDIDO WHERE {filtro}", parametro);
        var valor = await cmd.ExecuteScalarAsync();
        if (valor is null or DBNull) return NotFound(new { mensaje = "No encontramos ese pedido en tu cuenta." });
        var id = Convert.ToInt64(valor);
        if (!await compras.PuedeVer(id, actor, vista)) return NotFound(new { mensaje = "No encontramos ese pedido en tu cuenta." });
        return Ok(new { idPedido = id });
    }

}
