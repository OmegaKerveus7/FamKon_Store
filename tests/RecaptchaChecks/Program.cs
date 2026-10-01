using System.Net;
using System.Text;
using System.Text.Json;
using FamKon_store_api.Services;
using FamKon_store_api.Controllers;
using FamKon_store_api.Models.Compras;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

var count = 0;
void Check(bool value, string label) { if (!value) throw new Exception(label); count++; }
async Task Reject(Func<Task> action, int status, string label) {
    try { await action(); } catch (RecaptchaException ex) { Check(ex.Status == status, label); return; }
    throw new Exception(label);
}
var now = DateTimeOffset.UtcNow;
var handler = new GoogleHandler();
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["Recaptcha:SiteKey"] = "public-key", ["Recaptcha:SecretKey"] = "server-secret",
    ["Recaptcha:AllowedHostnames:0"] = "tienda.example.com"
}).Build();
var env = new TestEnvironment();
var service = new RecaptchaService(new HttpClient(handler), config, env, NullLogger<RecaptchaService>.Instance);
string Response(bool success = true, string host = "tienda.example.com", DateTimeOffset? time = null) => JsonSerializer.Serialize(new { success, hostname = host, challenge_ts = time ?? now });
handler.Body = Response();
Check(service.SiteKey == "public-key", "Solo expone clave pública");
await service.Verificar("valid-token");
Check(handler.Url == "https://www.google.com/recaptcha/api/siteverify", "Proveedor HTTPS fijo");
Check(handler.Form.Contains("secret=server-secret") && handler.Form.Contains("response=valid-token"), "Verifica secreto y respuesta en cuerpo POST");
await Reject(() => service.Verificar(null), 400, "Rechaza token ausente");
await Reject(() => service.Verificar(" "), 400, "Rechaza token vacío");
await Reject(() => service.Verificar(new string('a', 8193)), 400, "Limita tamaño del token");
Check(handler.Calls == 1, "Tokens inválidos no contactan Google");
handler.Body = Response(false);
await Reject(() => service.Verificar("invalid-token"), 400, "Rechaza validación negativa y tokens repetidos");
handler.Body = Response(host: "otro.example.com");
await Reject(() => service.Verificar("wrong-site"), 400, "Rechaza otro hostname");
handler.Body = Response(host: "tienda.example.com.attacker.test");
await Reject(() => service.Verificar("wrong-site"), 400, "No acepta coincidencia parcial del hostname");
handler.Body = Response(time: now.AddMinutes(-3));
await service.Verificar("fresh-token-after-long-challenge");
Check(true, "No confunde la carga antigua del desafío con un token vencido");
handler.Body = Response(time: now.AddMinutes(5));
await service.Verificar("google-approved-token");
Check(true, "No invalida aprobación de Google por diferencia entre relojes");
handler.Body = "{\"success\":true,\"hostname\":\"tienda.example.com\"}";
await service.Verificar("no-date");
Check(true, "La aprobación exige success y hostname, no una fecha local de expiración");
for (int i = 0; i < 4; i++) {
    var code = new[] { "invalid-input-secret", "missing-input-secret", "bad-request", "timeout-or-duplicate" }[i];
    handler.Body = JsonSerializer.Serialize(new Dictionary<string, object> { ["success"] = false, ["error-codes"] = new[] { code } });
    await Reject(() => service.Verificar("rejected"), i == 3 ? 400 : 503, "Distingue error Google: " + code);
}
handler.Body = "{\"success\":true}";
await Reject(() => service.Verificar("no-hostname"), 400, "Sigue exigiendo hostname en respuesta aprobada");
handler.Body = "not-json";
await Reject(() => service.Verificar("broken-response"), 503, "Maneja respuesta malformada");
handler.Status = HttpStatusCode.ServiceUnavailable;
await Reject(() => service.Verificar("unavailable"), 503, "No crea pedidos si Google falla");
handler.Status = HttpStatusCode.OK;
handler.Failure = new HttpRequestException("Network error");
await Reject(() => service.Verificar("network-error"), 503, "Maneja fallo de red");
handler.Failure = new TaskCanceledException();
await Reject(() => service.Verificar("timeout"), 503, "Maneja timeout");
handler.Failure = null;
config["Recaptcha:SecretKey"] = "";
var missing = new RecaptchaService(new HttpClient(handler), config, env, NullLogger<RecaptchaService>.Instance);
Check(missing.SiteKey is null, "Sin configuración no habilita widget");
await Reject(() => missing.Verificar("token"), 503, "Sin configuración no permite bypass");
config["Recaptcha:SecretKey"] = "server-secret";
config["Recaptcha:AllowedHostnames:0"] = "";
var noHosts = new RecaptchaService(new HttpClient(handler), config, env, NullLogger<RecaptchaService>.Instance);
await Reject(() => noHosts.Verificar("token"), 503, "Exige hostname permitido");
config["Recaptcha:AllowedHostnames:0"] = "tienda.example.com";
config["Recaptcha:SiteKey"] = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
var testingKey = new RecaptchaService(new HttpClient(handler), config, env, NullLogger<RecaptchaService>.Instance);
await Reject(() => testingKey.Verificar("token"), 503, "Claves públicas de prueba no funcionan en producción");

// Las dependencias de BD son null deliberadamente: un captcha inválido debe cortar antes de usarlas.
var controller = new ComprasController(null!, null!, null!, config, service) {
    ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
};
await Reject(() => controller.Crear(new CrearCompraRequest { MetodoPago = "EFECTIVO" }), 400, "Controller impide crear pedido sin captcha antes de tocar Oracle");
handler.Body = Response(false);
await Reject(() => controller.Crear(new CrearCompraRequest { MetodoPago = "EFECTIVO", RecaptchaToken = "invalid" }), 400, "Controller rechaza captcha inválido antes de tocar Oracle");
Console.WriteLine($"PASS: {count} comprobaciones de reCAPTCHA sin Google ni Oracle reales.");

sealed class GoogleHandler : HttpMessageHandler {
    public string Body = "{}", Url = "", Form = ""; public int Calls;
    public HttpStatusCode Status = HttpStatusCode.OK; public Exception? Failure;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) {
        Calls++; Url = request.RequestUri!.ToString(); Form = await request.Content!.ReadAsStringAsync(cancellationToken);
        if (Failure is not null) throw Failure;
        return new HttpResponseMessage(Status) { Content = new StringContent(Body, Encoding.UTF8, "application/json") };
    }
}
sealed class TestEnvironment : IHostEnvironment {
    public string EnvironmentName { get; set; } = "Production";
    public string ApplicationName { get; set; } = "Tests";
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
