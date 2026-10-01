using FamKon_store_api.Services;
using FamKon_store_api.Modules.Biometria;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace FamKon_store_api.Controllers;
[ApiController,Route("api/famkon/registro/rostro"),EnableRateLimiting("password")]
public class RegistroRostroController(IBiometriaClient client,RegistroRostroService rostros):ControllerBase {
 public record Captura(string FotoOriginalBase64);
 [HttpPost,RequestSizeLimit(3000000),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
 public async Task<IActionResult> Segmentar(Captura request){
  try{var original=CredencialService.Imagen(request.FotoOriginalBase64);var segmentada=await client.SegmentarAsync(original,HttpContext.RequestAborted);
var token=rostros.Guardar(original,segmentada);return Ok(new{solicitudRostro=token,rostroBase64=Convert.ToBase64String(segmentada),mime=ImagenBiometrica.Mime(segmentada)});}
  catch(BiometriaException ex){return StatusCode(ex.Estado,new{mensaje=ex.Message});}
  catch(InvalidOperationException ex){return BadRequest(new{mensaje=ex.Message});}
 }
}
