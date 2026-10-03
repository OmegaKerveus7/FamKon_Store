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
        if(ex is RecaptchaException captcha) { status=captcha.Status;message=captcha.Message; }
        else if(ex is OracleException o) {
            var n=Math.Abs(o.Number);
            status=n switch {20703=>403,1403=>404,20709 or 1=>409,20700 or 12899=>400,_=>500};
            if(n is 50000 or 12570 or 12170 or 12541 or 1013 or 30006 or 54) { status=503; message="La base de datos no respondió a tiempo o está ocupada. Intenta nuevamente en unos momentos."; }
            else if(n is >=20700 and <=20799) message=o.Message.Split('\n')[0].Split(':',2).Last().Trim();
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
public class ComprasController(CompraService compras,RecurrenteService pagos,ArchivoService archivos,IConfiguration config,IRecaptchaVerifier recaptcha):ControllerBase {
    private long Actor=>long.Parse(User.FindFirst("sub")!.Value);
    private static bool VistaValida(string vista)=>vista is "cliente" or "admin" or "repartidor";
    [HttpGet("configuracion")]
    public IActionResult Configuracion()=>Ok(new{direccionTienda=config["Tienda:Direccion"]??"Campus central",horario="Lunes a domingo, 8:00 a. m. a 5:00 p. m.",cargoDomicilio=25,cargoTienda=0,tarjetaDisponible=pagos.Disponible,entorno=pagos.Entorno,recaptchaSiteKey=recaptcha.SiteKey});
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
        await recaptcha.Verificar(r.RecaptchaToken, HttpContext.RequestAborted);
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
        string Fecha(JsonElement el,string key) {
            if(!el.TryGetProperty(key,out var value)||!DateTimeOffset.TryParse(value.ToString(),out var date))return "—";
            return E(date.ToOffset(TimeSpan.FromHours(-6)).ToString("dd/MM/yyyy · hh:mm tt",new System.Globalization.CultureInfo("es-GT")));
        }
        string Dinero(JsonElement el,string key) {
            if(!el.TryGetProperty(key,out var value)||!decimal.TryParse(value.ToString(),System.Globalization.NumberStyles.Any,System.Globalization.CultureInfo.InvariantCulture,out var amount))return "Q 0.00";
            return E($"Q {amount:N2}");
        }
        var entrega=json.GetProperty("entregas").EnumerateArray().First(x=>x.GetProperty("estado").GetString() is "ENTREGADA" or "RECOGIDA");
        var rows=string.Join("",json.GetProperty("productos").EnumerateArray().Select(x=>$"<tr><td><strong>{V(x,"nombreProducto")}</strong><small>{V(x,"skuProducto")}</small></td><td class=number>{V(x,"cantidad")}</td><td class=number>{Dinero(x,"subtotal")}</td></tr>"));
        var recogida=p.GetProperty("idModalidadEntrega").GetInt32()==1;
        var destino=recogida?E(config["Tienda:Direccion"]??"Campus central"):V(p,"direccionEntrega");
        var ubicacion=recogida?"Recogida en tienda":E(string.Join(", ",new[]{V(p,"municipio"),V(p,"departamento")}.Where(x=>!string.IsNullOrWhiteSpace(x))));
        var pago=V(p,"metodoPago").Replace("_"," "); var estadoPago=V(p,"estadoPago").Replace("_"," ");
        var html=$$$"""
        <!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante {{{V(p,"numeroPedido")}}}</title>
        <style>
        *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font:15px/1.5 Inter,Segoe UI,system-ui,sans-serif}.page{width:min(860px,calc(100% - 32px));margin:32px auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px #0f172a12}.hero{position:relative;padding:34px 42px;background:#0f172a;color:#fff}.hero:after{content:"";position:absolute;inset:auto 0 0;height:5px;background:#f97316}.brand{font-size:28px;font-weight:800;letter-spacing:-.03em}.brand span{color:#fb923c}.eyebrow{margin:4px 0 0;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:.18em}.hero-grid{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-top:28px}.hero h1{margin:0;font-size:21px}.order{margin:7px 0 0;color:#cbd5e1}.status{display:inline-flex;padding:7px 12px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:800;text-transform:uppercase}.content{padding:34px 42px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.label{margin:0 0 4px;color:#64748b;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.value{margin:0;font-weight:650}.muted{margin:3px 0 0;color:#64748b;font-size:13px}.section-title{margin:30px 0 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}th{padding:11px 14px;background:#f1f5f9;color:#475569;font-size:10px;text-align:left;text-transform:uppercase}td{padding:14px;border-top:1px solid #e2e8f0}td small{display:block;margin-top:2px;color:#94a3b8;font-size:10px}.number{text-align:right}.summary{display:grid;grid-template-columns:1fr 280px;gap:28px;align-items:start;margin-top:22px}.payment{padding:16px;border-radius:12px;background:#fff7ed;color:#9a3412}.totals{display:grid;grid-template-columns:1fr auto;gap:8px 18px}.totals span{color:#64748b}.totals strong{padding-top:12px;border-top:1px solid #cbd5e1;font-size:20px}.total-label{padding-top:16px!important;border-top:1px solid #cbd5e1;color:#0f172a!important;font-weight:800}.footer{display:flex;justify-content:space-between;gap:20px;margin-top:34px;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px}.print{position:fixed;right:24px;bottom:24px;border:0;border-radius:12px;background:#f97316;color:#fff;padding:12px 18px;font:700 14px inherit;box-shadow:0 10px 24px #f9731640;cursor:pointer}@media(max-width:620px){.page{width:100%;margin:0;border:0;border-radius:0}.hero,.content{padding:26px 20px}.hero-grid{display:block}.status{margin-top:16px}.cards,.summary{grid-template-columns:1fr}.footer{display:block}.print{right:14px;bottom:14px}}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{background:#fff!important}.page{width:100%;margin:0;border:0;box-shadow:none}.hero{background:#0f172a!important;color:#fff!important}.hero:after{background:#f97316!important}.brand span{color:#fb923c!important}.eyebrow{color:#94a3b8!important}.order{color:#cbd5e1!important}.status{background:#dcfce7!important;color:#166534!important}.card{background:#f8fafc!important}th{background:#f1f5f9!important}.payment{background:#fff7ed!important;color:#9a3412!important}.print{display:none!important}@page{size:A4;margin:10mm}}
        </style></head><body><main class="page">
        <header class="hero"><div class="brand">Fam<span>Kon</span></div><p class="eyebrow">TIENDA EN LÍNEA</p><div class="hero-grid"><div><h1>Comprobante de entrega</h1><p class="order">Pedido <strong>{{{V(p,"numeroPedido")}}}</strong></p></div><span class="status">{{{V(p,"estadoNombre")}}}</span></div></header>
        <div class="content"><section class="cards"><article class="card"><p class="label">Comprador</p><p class="value">{{{V(p,"cliente")}}}</p><p class="muted">Recibió: {{{V(entrega,"nombreReceptor")}}}</p></article><article class="card"><p class="label">Fecha de recepción</p><p class="value">{{{Fecha(entrega,"fechaEntrega")}}}</p><p class="muted">{{{ubicacion}}}</p></article></section>
        <section class="card" style="margin-top:14px"><p class="label">Destino</p><p class="value">{{{destino}}}</p>{{{(string.IsNullOrWhiteSpace(V(p,"referenciaEntrega"))?"":$"<p class=muted>Referencia: {V(p,"referenciaEntrega")}</p>")}}}</section>
        <h2 class="section-title">Detalle de productos</h2><table><thead><tr><th>Producto</th><th class=number>Cantidad</th><th class=number>Subtotal</th></tr></thead><tbody>{{{rows}}}</tbody></table>
        <section class="summary"><div class="payment"><p class="label" style="color:#c2410c">Información del pago</p><p class="value">{{{pago}}}</p><p class="muted" style="color:#9a3412">{{{estadoPago}}}</p></div><div class="totals"><span>Subtotal</span><b>{{{Dinero(p,"subtotal")}}}</b><span>Entrega</span><b>{{{Dinero(p,"cargoEntrega")}}}</b><span class="total-label">Total</span><strong>{{{Dinero(p,"total")}}}</strong></div></section>
        <footer class="footer"><span>Constancia de recepción del pedido. No sustituye una factura fiscal.</span><span>FamKon · {{{V(p,"numeroPedido")}}}</span></footer></div></main><button class="print" onclick="window.print()">Imprimir comprobante</button></body></html>
        """;
        return File(Encoding.UTF8.GetBytes(html),"text/html; charset=utf-8",$"comprobante-{id}.html");
    }
    [AllowAnonymous,HttpPost("recurrente/webhook"),RequestSizeLimit(65536)]
    public async Task<IActionResult> Webhook() {
        using var ms=new MemoryStream();await Request.Body.CopyToAsync(ms);
        await pagos.Webhook(ms.ToArray(),Request.Headers["svix-id"].ToString(),Request.Headers["svix-timestamp"].ToString(),Request.Headers["svix-signature"].ToString());return Ok();
    }
}
