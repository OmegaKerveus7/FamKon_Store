using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Oracle.ManagedDataAccess.Client;
namespace FamKon_store_api.Services;

public class RecurrenteService(HttpClient http,IConfiguration config,CompraService compras,IHostEnvironment host) {
    public string Entorno => (config["Recurrente:Environment"] ?? "Sandbox").ToUpperInvariant() switch { "SANDBOX" or "TEST"=>"TEST", "LIVE" or "PRODUCTION"=>"LIVE", _=>throw new InvalidOperationException("Entorno de Recurrente inválido.") };
    public bool Disponible => !string.IsNullOrWhiteSpace(config["Recurrente:SecretKey"]);
    public bool WebhookConfigurado => !string.IsNullOrWhiteSpace(config["Recurrente:WebhookSecret"]);
    private async Task<JsonDocument> Api(HttpMethod method,string path,object? body=null,string? idempotency=null) {
        var key=config["Recurrente:SecretKey"] ?? "";
        if(!Disponible) throw new InvalidOperationException("El pago con tarjeta todavía no está configurado.");
        if((Entorno=="TEST" && !key.StartsWith("sk_test_")) || (Entorno=="LIVE" && !key.StartsWith("sk_live_"))) throw new InvalidOperationException("La clave no corresponde al entorno de pagos.");
        if(Entorno=="LIVE" && !host.IsProduction()) throw new InvalidOperationException("Los cobros LIVE solo se habilitan en producción.");
        using var req=new HttpRequestMessage(method,"https://app.recurrente.com/api/"+path);
        req.Headers.Add("X-SECRET-KEY",key);
        if(idempotency is not null) req.Headers.Add("Idempotency-Key",idempotency);
        if(body is not null) req.Content=JsonContent.Create(body);
        using var res=await http.SendAsync(req);
        if(!res.IsSuccessStatusCode) throw new InvalidOperationException($"Recurrente no pudo completar la solicitud (HTTP {(int)res.StatusCode}). Puedes reintentar; el pedido se conserva.");
        return JsonDocument.Parse(await res.Content.ReadAsStringAsync());
    }
    public async Task<string> Checkout(long pedido,long actor) {
        using var c=await compras.Abrir(actor); using var tx=c.BeginTransaction();
        // Bloqueo por pedido: evita crear varias sesiones por dobles clics concurrentes.
        using(var locked=CompraService.Comando(c,"SELECT ID_PEDIDO FROM PEDIDO WHERE ID_PEDIDO=:id AND ID_USUARIO=:actor FOR UPDATE",("id",pedido),("actor",actor))) {
            if(await locked.ExecuteScalarAsync() is null) throw new UnauthorizedAccessException();
        }
        var p=await compras.Resumen(pedido,c) ?? throw new KeyNotFoundException();
        if((string?)p["metodoPago"]!="TARJETA" || (string?)p["entorno"]!=Entorno || (string?)p["estado"]=="CANCELADO" || (string?)p["estadoPago"] is not ("PENDIENTE" or "RECHAZADO")) throw new InvalidOperationException("El pedido no admite iniciar este pago.");
        using(var existing=CompraService.Comando(c,"SELECT CHECKOUT_URL FROM PAGO WHERE ID_PAGO=:id",("id",p["idPago"]))) {
            var url=await existing.ExecuteScalarAsync(); if(url is string saved && saved.Length>0) {tx.Commit();return saved;}
        }
        var web=(config["Recurrente:FrontendUrl"] ?? (host.IsDevelopment()?"http://localhost:5173":"")).TrimEnd('/');
        if(!Uri.TryCreate(web,UriKind.Absolute,out var webUri) || (host.IsProduction() && webUri.Scheme!="https")) throw new InvalidOperationException("Configura la dirección pública de la tienda para recibir el resultado del pago.");
        var payload=new {
            items=new[]{new { name=$"Pedido {p["numeroPedido"]}",amount_in_cents=decimal.ToInt64(Convert.ToDecimal(p["total"])*100),currency="GTQ",quantity=1,payment_method_types=new[]{"card"},available_installments=Array.Empty<int>() }},
            success_url=$"{web}/comprador/tracking?pedido={pedido}&pago=retorno",
            cancel_url=$"{web}/comprador/tracking?pedido={pedido}&pago=cancelado",
            metadata=new { pedido_id=pedido.ToString(),entorno=Entorno }
        };
        using var result=await Api(HttpMethod.Post,"checkouts",payload,$"famkon-{Entorno}-pago-{p["idPago"]}");
        var id=result.RootElement.GetProperty("id").GetString()!;
        var checkoutUrl=result.RootElement.GetProperty("checkout_url").GetString()!;
        if(!Uri.TryCreate(checkoutUrl,UriKind.Absolute,out var uri)||uri.Scheme!="https"||!(uri.Host=="recurrente.com"||uri.Host.EndsWith(".recurrente.com"))) throw new InvalidOperationException("Recurrente devolvió una dirección de pago no válida.");
        using var save=CompraService.Comando(c,"UPDATE PAGO SET ID_CHECKOUT_PROVEEDOR=:checkout,CHECKOUT_URL=:url WHERE ID_PAGO=:id",("checkout",id),("url",checkoutUrl),("id",p["idPago"]));
        await save.ExecuteNonQueryAsync();tx.Commit();return checkoutUrl;
    }
    public async Task<string> Sincronizar(long pedido,long actor) {
        var p=await compras.Resumen(pedido)??throw new KeyNotFoundException();
        if((string?)p["metodoPago"]!="TARJETA" || p["idCheckoutProveedor"] is not string checkout) return (string?)p["estadoPago"]??"PENDIENTE";
        if((string?)p["entorno"]!=Entorno) throw new InvalidOperationException("Este pago pertenece a otro entorno.");
        using var doc=await Api(HttpMethod.Get,"checkouts/"+Uri.EscapeDataString(checkout));
        var root=doc.RootElement;
        // La vuelta del navegador nunca confirma un pago: se consulta al proveedor.
        if(root.GetProperty("id").GetString()!=checkout) throw new InvalidOperationException("La respuesta de pago no corresponde al pedido.");
        if(root.GetProperty("status").GetString()=="paid") {
            var amount=root.GetProperty("total_in_cents").GetDecimal()/100m;
            var currency=root.GetProperty("currency").GetString()!;
            await Confirmar(checkout,$"consulta-{checkout}-paid","consulta.checkout.paid","APROBADO",amount,currency,null);
        }
        return (string?)(await compras.Resumen(pedido))?["estadoPago"]??"PENDIENTE";
    }
    public static bool FirmaValida(string secret,string id,string timestamp,string signatures,byte[] body,DateTimeOffset now) {
        if(!long.TryParse(timestamp,out var seconds) || Math.Abs(now.ToUnixTimeSeconds()-seconds)>300 || string.IsNullOrWhiteSpace(id))return false;
        try {
            var key=Convert.FromBase64String(secret.StartsWith("whsec_")?secret[6..]:secret);
            var prefix=Encoding.UTF8.GetBytes($"{id}.{timestamp}.");
            var data=new byte[prefix.Length+body.Length];prefix.CopyTo(data,0);body.CopyTo(data,prefix.Length);
            var expected=HMACSHA256.HashData(key,data);
            return signatures.Split(' ',StringSplitOptions.RemoveEmptyEntries).Any(s=> {
                var parts=s.Split(',',2);if(parts.Length!=2||parts[0]!="v1")return false;
                try{return CryptographicOperations.FixedTimeEquals(expected,Convert.FromBase64String(parts[1]));}catch(FormatException){return false;}
            });
        } catch(FormatException){return false;}
    }
    public async Task Webhook(byte[] body,string id,string timestamp,string signatures) {
        var secret=config["Recurrente:WebhookSecret"]??"";
        if(secret.Length==0) throw new InvalidOperationException("Falta configurar la firma de webhooks.");
        if(!FirmaValida(secret,id,timestamp,signatures,body,DateTimeOffset.UtcNow))throw new UnauthorizedAccessException("Firma de webhook inválida.");
        using var doc=JsonDocument.Parse(body);var r=doc.RootElement;
        var type=r.GetProperty("event_type").GetString();
        if(type is not ("intent.succeeded" or "intent.failed"))return;
        if(r.GetProperty("type").GetString()!="payment")return;
        if(r.TryGetProperty("live_mode",out var live) && live.GetBoolean()!=(Entorno=="LIVE"))throw new InvalidOperationException("Evento de un entorno diferente.");
        var checkout=r.GetProperty("checkout").GetProperty("id").GetString()!;
        var estado=type=="intent.succeeded"?"APROBADO":"RECHAZADO";
        await Confirmar(checkout,id,type,estado,r.GetProperty("amount_in_cents").GetDecimal()/100m,r.GetProperty("currency").GetString()!,r.GetProperty("id").GetString());
    }
    private Task<long> Confirmar(string checkout,string evento,string tipo,string estado,decimal monto,string moneda,string? referencia)=>compras.Ejecutar(0,"CONFIRMAR_PAGO",("P_CHECKOUT",checkout),("P_ENTORNO",Entorno),("P_EVENTO",evento),("P_TIPO",tipo),("P_ESTADO",estado),("P_MONTO",monto),("P_MONEDA",moneda),("P_REFERENCIA",referencia));
}
