using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace FamKon_store_api.Controllers;
[ApiController,Authorize,Route("api/famkon/credencial"),ServiceFilter(typeof(CompraExceptionFilter))]
public class CredencialController(CredencialService credencial,CompraService compras,RegistroRostroService rostros):ControllerBase {
 long Actor=>long.Parse(User.FindFirst("sub")!.Value);
 public record FotoRequest(string FotoOriginal,string FotoEditada,string SolicitudRostro="",string Tema="AZUL");
 [HttpGet] public async Task<IActionResult> Estado(){using var c=await compras.Abrir(Actor);using var cmd=CompraService.Comando(c,"SELECT CANAL,ESTADO FROM CREDENCIAL_ENVIO WHERE ID_USUARIO=:id",("id",Actor));var envios=await CompraService.Leer(cmd);using var theme=CompraService.Comando(c,"SELECT TEMA FROM CREDENCIAL WHERE ID_USUARIO=:id",("id",Actor));var tema=await theme.ExecuteScalarAsync() as string;return Ok(new{existe=tema is not null,tema=tema??"AZUL",envios});}
 [HttpPost,RequestSizeLimit(6000000)] public async Task<IActionResult> Crear(FotoRequest r){var rostro=rostros.Obtener(r.SolicitudRostro,r.FotoOriginal);await credencial.Emitir(Actor,CredencialService.Imagen(r.FotoEditada),rostro.Original,rostro.Segmentada,r.Tema);rostros.Eliminar(r.SolicitudRostro);return Ok(new{mensaje="Credencial creada y envío programado. El QR anterior quedó invalidado."});}
 [HttpPost("reemplazar")] public async Task<IActionResult> Reemplazar(){await credencial.Emitir(Actor);return Ok(new{mensaje="QR reemplazado. El anterior ya no permite ingresar."});}
 [HttpPost("reenviar")] public async Task<IActionResult> Reenviar(){await credencial.Reenviar(Actor);return Ok(new{mensaje="Envío programado según tus preferencias."});}
 [HttpGet("pdf"),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)] public async Task<IActionResult> Pdf(){var b=await credencial.Leer(Actor);return b is null?NotFound():File(b,"application/pdf","credencial-famkon.pdf");}
 [HttpGet("foto"),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)] public async Task<IActionResult> Foto(){var b=await credencial.Leer(Actor,true);return b is null?NotFound():File(b,b[0]==137?"image/png":"image/jpeg");}
 [AllowAnonymous,HttpGet("documento/{token}"),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)] public async Task<IActionResult> Documento(string token){var b=await credencial.Documento(token);Response.Headers["Referrer-Policy"]="no-referrer";Response.Headers["X-Content-Type-Options"]="nosniff";return b is null?NotFound():File(b,"application/pdf","credencial-famkon.pdf");}
}
