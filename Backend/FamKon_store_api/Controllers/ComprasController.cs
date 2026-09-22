using System.Net;
using System.Text;
using System.Text.Json;
using FamKon_store_api.Models.Compras;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Oracle.ManagedDataAccess.Client;
namespace FamKon_store_api.Controllers;

public class CompraExceptionFilter(ILogger<CompraExceptionFilter> logger):IExceptionFilter {
    public void OnException(ExceptionContext ctx) {
        var ex=ctx.Exception; var status=500; var message="No se pudo completar la operación. Intenta nuevamente.";
        if(ex is OracleException o) {
            var n=Math.Abs(o.Number);
            status=n switch {20703=>403,1403=>404,20709 or 1=>409,20700 or 12899=>400,_=>500};
            if(n is >=20700 and <=20799) message=o.Message.Split('\n')[0].Split(':',2).Last().Trim();
            else if(n==1403)message="No se encontró el pedido, asignación o configuración requerida.";
        } else if(ex is UnauthorizedAccessException) {status=403;message="No tienes acceso a esta operación.";}
        else if(ex is InvalidOperationException) {status=409;message=ex.Message;}
        else if(ex is KeyNotFoundException) {status=404;message="No se encontró el pedido.";}
        else if(ex is JsonException or FormatException) {status=400;message="Datos de pago no válidos.";}
        logger.LogWarning(ex,"Operación de compra rechazada ({Status})",status);
        ctx.Result=new ObjectResult(new{mensaje=message}){StatusCode=status};ctx.ExceptionHandled=true;
    }
}
[ApiController,Authorize,Route("api/famkon/compras"),ServiceFilter(typeof(CompraExceptionFilter))]
public class ComprasController(CompraService compras,RecurrenteService pagos,ArchivoService archivos,IConfiguration config):ControllerBase {
    private long Actor=>long.Parse(User.FindFirst("sub")!.Value);
    private static bool VistaValida(string vista)=>vista is "cliente" or "admin" or "repartidor";
    [HttpGet("configuracion")]
    public IActionResult Configuracion()=>Ok(new{direccionTienda=config["Tienda:Direccion"]??"Campus central",horario="Lunes a domingo, 8:00 a. m. a 5:00 p. m.",cargoDomicilio=25,cargoTienda=0,tarjetaDisponible=pagos.Disponible,entorno=pagos.Entorno});
    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery]string vista="cliente",[FromQuery]int pagina=1,[FromQuery]string? estado=null,[FromQuery]string? busqueda=null) {
        if(!VistaValida(vista))return BadRequest(); if(vista=="admin"&&!await compras.EsAdmin(Actor))return Forbid();
        return Ok(await compras.Listar(Actor,vista,Math.Clamp(pagina,1,100000),estado,busqueda?.Trim()));
    }
    [HttpGet("repartidores")]
    public async Task<IActionResult> Repartidores() {if(!await compras.EsAdmin(Actor))return Forbid();return Ok(await compras.Repartidores(Actor));}
    [HttpGet("{id:long}")]
    public async Task<IActionResult> Detalle(long id,[FromQuery]string vista="cliente") {
        if(!VistaValida(vista))return BadRequest();var detail=await compras.Detalle(id,Actor,vista);return detail is null?NotFound():Ok(detail);
    }
    [HttpPost]
    public async Task<IActionResult> Crear(CrearCompraRequest r) {
        if(r.MetodoPago=="TARJETA"&&!pagos.Disponible)return Conflict(new{mensaje="La tarjeta aún no está disponible. Puedes elegir efectivo."});
        var id=await compras.Crear(Actor,r,pagos.Entorno);return Ok(new{idPedido=id});
    }
    [HttpPost("{id:long}/estado")]
    public async Task<IActionResult> Estado(long id,EstadoCompraRequest r) {
        await compras.Ejecutar(Actor,"AVANZAR",("P_PEDIDO",id),("P_ACTOR",Actor),("P_ESTADO",r.Estado),("P_COMENTARIO",r.Comentario));return Ok(new{mensaje="Estado actualizado."});
    }
    [HttpPost("{id:long}/asignar")]
    public async Task<IActionResult> Asignar(long id,AsignarCompraRequest r) {
        await compras.Ejecutar(Actor,"ASIGNAR",("P_PEDIDO",id),("P_ACTOR",Actor),("P_REPARTIDOR",r.IdRepartidor));return Ok(new{mensaje="Entrega asignada."});
    }
    [HttpPost("{id:long}/resultado")]
    public async Task<IActionResult> Resultado(long id,ResultadoCompraRequest r) {
        await compras.Ejecutar(Actor,"FINALIZAR",("P_PEDIDO",id),("P_ACTOR",Actor),("P_RESULTADO",r.Resultado),("P_RECEPTOR",r.NombreReceptor),("P_EVIDENCIA",r.IdArchivoEvidencia),("P_EFECTIVO",r.MontoEfectivo),("P_COMENTARIO",r.Comentario));return Ok(new{mensaje="Resultado registrado."});
    }
    [HttpPut("{id:long}/direccion")]
    public async Task<IActionResult> Corregir(long id,CorregirCompraRequest r) {
        await compras.Ejecutar(Actor,"CORREGIR",("P_PEDIDO",id),("P_ACTOR",Actor),("P_TELEFONO",r.TelefonoContacto),("P_ALTERNO",r.TelefonoAlterno),("P_DEPARTAMENTO",r.Departamento),("P_MUNICIPIO",r.Municipio),("P_DIRECCION",r.DireccionEntrega),("P_REFERENCIA",r.ReferenciaEntrega),("P_MOTIVO",r.Motivo));return Ok(new{mensaje="Datos corregidos con auditoría."});
    }
    [HttpPost("{id:long}/pago")]
    public async Task<IActionResult> Pago(long id) {if(!await compras.PuedeVer(id,Actor,"cliente"))return NotFound();return Ok(new{url=await pagos.Checkout(id,Actor)});}
    [HttpPost("{id:long}/verificar-pago")]
    public async Task<IActionResult> VerificarPago(long id) {if(!await compras.PuedeVer(id,Actor,"cliente")&&!await compras.PuedeVer(id,Actor,"admin"))return NotFound();return Ok(new{estado=await pagos.Sincronizar(id,Actor)});}
    [HttpPost("{id:long}/evidencia"),RequestSizeLimit(6*1024*1024)]
    public async Task<IActionResult> Evidencia(long id,IFormFile archivo) {
        if(!await compras.PuedeVer(id,Actor,"repartidor")&&!await compras.PuedeVer(id,Actor,"admin"))return Forbid();
        if(archivo.Length is <=0 or >5*1024*1024)return BadRequest(new{mensaje="La foto debe pesar hasta 5 MB."});
        using var stream=new MemoryStream();await archivo.CopyToAsync(stream);var data=stream.ToArray();
        var mime=data.Length>8&&data[0]==0x89&&data[1]==0x50&&data[2]==0x4e&&data[3]==0x47?"image/png":data.Length>3&&data[0]==0xff&&data[1]==0xd8&&data[2]==0xff?"image/jpeg":null;
        if(mime is null)return BadRequest(new{mensaje="Usa una foto JPG o PNG."});
        var saved=await archivos.GuardarArchivoAsync(Actor,"EVIDENCIA_ENTREGA",$"entrega-{id}-{Guid.NewGuid():N}."+(mime=="image/png"?"png":"jpg"),mime,data);
        return saved is null?StatusCode(500,new{mensaje="No se pudo guardar la foto."}):Ok(new{idArchivo=saved.IdArchivo});
    }
    [HttpGet("{id:long}/comprobante")]
    public async Task<IActionResult> Comprobante(long id,[FromQuery]string vista="cliente") {
        if(!VistaValida(vista))return BadRequest();var detail=await compras.Detalle(id,Actor,vista);if(detail is null)return NotFound();
        var json=JsonSerializer.SerializeToElement(detail);var p=json.GetProperty("pedido");
        if(p.GetProperty("estado").GetString() is not ("ENTREGADO" or "RECOGIDO"))return Conflict(new{mensaje="El comprobante está disponible al finalizar la entrega."});
        string E(string? s)=>WebUtility.HtmlEncode(s??"");
        string V(JsonElement el,string key)=>el.TryGetProperty(key,out var v)?E(v.ToString()):"";
        var entrega=json.GetProperty("entregas").EnumerateArray().First(x=>x.GetProperty("estado").GetString() is "ENTREGADA" or "RECOGIDA");
        var rows=string.Join("",json.GetProperty("productos").EnumerateArray().Select(x=>$"<tr><td>{V(x,"nombreProducto")}</td><td>{V(x,"cantidad")}</td><td>Q{V(x,"subtotal")}</td></tr>"));
        var html=$$"""
        <!doctype html><html lang="es"><meta charset="utf-8"><title>Comprobante {{V(p,"numeroPedido")}}</title>
        <style>body{font:16px system-ui;max-width:760px;margin:48px auto;padding:24px;color:#172033}h1{color:#b45309}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}small{color:#64748b}</style>
        <h1>FamKon · Comprobante de entrega</h1><p>Pedido <b>{{V(p,"numeroPedido")}}</b> · {{V(p,"estadoNombre")}}</p>
        <p>Cliente: {{V(p,"cliente")}}<br>Recibió: {{V(entrega,"nombreReceptor")}}<br>Fecha de recepción: {{V(entrega,"fechaEntrega")}}</p>
        <p>Destino: {{(p.GetProperty("idModalidadEntrega").GetInt32()==1?E(config["Tienda:Direccion"]??"Campus central"):V(p,"direccionEntrega"))}}</p>
        <table><thead><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>{{rows}}</tbody></table>
        <p>Envío: Q{{V(p,"cargoEntrega")}} · <b>Total: Q{{V(p,"total")}}</b></p><p>Pago: {{V(p,"metodoPago")}} · {{V(p,"estadoPago")}}</p>
        <small>Constancia de recepción del pedido. No sustituye una factura fiscal.</small></html>
        """;
        return File(Encoding.UTF8.GetBytes(html),"text/html; charset=utf-8",$"comprobante-{id}.html");
    }
    [AllowAnonymous,HttpPost("recurrente/webhook"),RequestSizeLimit(65536)]
    public async Task<IActionResult> Webhook() {
        using var ms=new MemoryStream();await Request.Body.CopyToAsync(ms);
        await pagos.Webhook(ms.ToArray(),Request.Headers["svix-id"].ToString(),Request.Headers["svix-timestamp"].ToString(),Request.Headers["svix-signature"].ToString());return Ok();
    }
}
