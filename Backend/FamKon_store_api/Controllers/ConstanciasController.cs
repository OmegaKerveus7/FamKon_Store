using FamKon_store_api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Oracle.ManagedDataAccess.Types;
namespace FamKon_store_api.Controllers;
[ApiController,Route("api/famkon/constancias"),ServiceFilter(typeof(CompraExceptionFilter))]
public class ConstanciasController(CompraService compras):ControllerBase {
 private long Actor=>long.Parse(User.FindFirst("sub")!.Value);
 public record Preferencias(bool Email,bool Whatsapp);
 [Authorize,HttpGet("preferencias")]
 public async Task<IActionResult> Preferencia() {
  using var c=await compras.Abrir(Actor);using var cmd=CompraService.Comando(c,"SELECT NOTIFICA_EMAIL,NOTIFICA_WHATSAPP FROM USUARIO WHERE ID_USUARIO=:id",("id",Actor));
  using var r=await cmd.ExecuteReaderAsync();if(!await r.ReadAsync())return NotFound();return Ok(new{email=r.GetString(0)=="S",whatsapp=r.GetString(1)=="S"});
 }
 [Authorize,HttpPut("preferencias")]
 public async Task<IActionResult> Guardar(Preferencias p) {
  if(!p.Email&&!p.Whatsapp)return BadRequest(new{mensaje="Selecciona al menos un medio."});
  using var c=await compras.Abrir(Actor);using var cmd=CompraService.Comando(c,"UPDATE USUARIO SET NOTIFICA_EMAIL=:email,NOTIFICA_WHATSAPP=:wa WHERE ID_USUARIO=:id",("email",p.Email?"S":"N"),("wa",p.Whatsapp?"S":"N"),("id",Actor));
  await cmd.ExecuteNonQueryAsync();return Ok(new{mensaje="Preferencias guardadas para próximas compras."});
 }
 [Authorize,HttpGet("{id:long}/estado")]
 public async Task<IActionResult> Estado(long id) {
  if(!await compras.PuedeVer(id,Actor,"cliente"))return NotFound();
  using var c=await compras.Abrir(Actor);using var cmd=CompraService.Comando(c,"SELECT CANAL,ESTADO FROM COMPRA_CONSTANCIA WHERE ID_PEDIDO=:id",("id",id));return Ok(await CompraService.Leer(cmd));
 }
 [Authorize,HttpPost("{id:long}/reintentar")]
 public async Task<IActionResult> Reintentar(long id) {
  if(!await compras.PuedeVer(id,Actor,"cliente"))return NotFound();
  using var c=await compras.Abrir(Actor);using var cmd=CompraService.Comando(c,"UPDATE COMPRA_CONSTANCIA SET ESTADO='PENDIENTE' WHERE ID_PEDIDO=:id AND ESTADO='ERROR' AND EXPIRA<SYSTIMESTAMP+INTERVAL '2' DAY-INTERVAL '10' MINUTE",("id",id));
  var n=await cmd.ExecuteNonQueryAsync();return n>0?Ok(new{mensaje="Envío programado."}):Conflict(new{mensaje="Espera 10 minutos desde el intento anterior para reintentar."});
 }
 [AllowAnonymous,HttpGet("documento/{token}"),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
 public async Task<IActionResult> Documento(string token) {
  if(token.Length!=64||!token.All(c=>char.IsAsciiHexDigit(c)))return NotFound();
  using var c=await compras.Abrir();
  using var cmd=CompraService.Comando(c,"SELECT PDF FROM COMPRA_CONSTANCIA WHERE TOKEN=:token AND EXPIRA>SYSTIMESTAMP AND PDF IS NOT NULL",("token",token));
  using var reader=await cmd.ExecuteReaderAsync();if(!await reader.ReadAsync())return NotFound();
  using OracleBlob blob=reader.GetOracleBlob(0);
  Response.Headers["X-Content-Type-Options"]="nosniff";
  Response.Headers["Referrer-Policy"]="no-referrer";
  return File(blob.Value,"application/pdf","constancia.pdf");
 }
}
