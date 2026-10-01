using System.Net;
using System.Text;
using System.Text.Json;
using FamKon_store_api.Modules.Biometria;
using FamKon_store_api.Models;
using Microsoft.Extensions.Configuration;

if (args.Length == 2 && args[0] == "--oracle")
{
    var config = new ConfigurationBuilder().AddJsonFile(Path.GetFullPath("Backend/FamKon_store_api/appsettings.json")).Build();
    var repository = new BiometriaRepository(new FamKon_store_api.BD.DBContext(config));
    try
    {
        var cuenta = await repository.BuscarAsync(null, long.Parse(args[1]), default);
        if (cuenta is null) throw new Exception("No se encontró la cuenta de comprobación.");
        var porCorreo = await repository.BuscarAsync(cuenta.Usuario.Correo, null, default);
        if (porCorreo?.Usuario.IdUsuario != cuenta.Usuario.IdUsuario) throw new Exception("Consulta por correo inconsistente.");
        Console.WriteLine("Oracle: consulta biométrica por ID y correo correcta. Solo lectura; sin mostrar datos personales.");
    }
    catch (Oracle.ManagedDataAccess.Client.OracleException ex)
    {
        Console.WriteLine($"Consulta biométrica: ORA-{ex.Number:D5}");
        Environment.ExitCode = 1;
    }
    return;
}

int pruebas = 0;
void Check(bool ok, string nombre) { if (!ok) throw new Exception(nombre); pruebas++; }
async Task Error(string codigo, Func<Task> action) {
    try { await action(); throw new Exception("Se aceptó una operación inválida: " + codigo); }
    catch (BiometriaException ex) { Check(ex.Codigo == codigo, $"Esperado {codigo}, recibido {ex.Codigo}"); }
}
var foto = new byte[] { 0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 0xff, 0xd9 };
BiometriaClient Client(string body, HttpStatusCode status = HttpStatusCode.OK, Action<HttpRequestMessage, string>? check = null) =>
    new(new HttpClient(new Handler(async (r, ct) => {
        check?.Invoke(r, await r.Content!.ReadAsStringAsync(ct));
        return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    })), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Biometria:BaseUrl"] = "https://example.invalid" }).Build());

var client = Client(JsonSerializer.Serialize(new { resultado = true, segmentado = true, rostro = Convert.ToBase64String(foto) }), check: (r, body) => {
    Check(r.RequestUri!.AbsolutePath == "/api/Rostro/Segmentar", "Ruta de segmentación");
    using var d = JsonDocument.Parse(body);
    Check(d.RootElement.GetProperty("RostroA").GetString() == Convert.ToBase64String(foto), "Contrato RostroA");
    Check(d.RootElement.GetProperty("RostroB").GetString() == "", "RostroB vacío al segmentar");
});
Check((await client.SegmentarAsync(foto, default)).SequenceEqual(foto), "Segmentación camelCase");
await Client("{\"Resultado\":true,\"Coincide\":true,\"Score\":\"197\"}").VerificarAsync(foto, foto, default);
pruebas++;
await Error("BIO_NO_COINCIDE", () => Client("{\"resultado\":true,\"coincide\":false}").VerificarAsync(foto, foto, default));
await Error("BIO_VERIFICACION_ERROR", () => Client("{\"resultado\":false,\"coincide\":true}").VerificarAsync(foto, foto, default));
await Error("BIO_VERIFICACION_ERROR", () => Client("{}").VerificarAsync(foto, foto, default));
await Error("BIO_RESPUESTA_INVALIDA", () => Client("<html>Error</html>").VerificarAsync(foto, foto, default));
await Error("BIO_PROVEEDOR_HTTP", () => Client("{}", HttpStatusCode.ServiceUnavailable).VerificarAsync(foto, foto, default));
await Error("BIO_ROSTRO_NO_DETECTADO", () => Client("{\"resultado\":true,\"segmentado\":false}").SegmentarAsync(foto, default));
await Error("BIO_NO_ACTIVADO", () => Client(JsonSerializer.Serialize(new { resultado = false, segmentado = false, error = "Neurotec.NotActivatedException: Component is not activated: Biometrics.FaceSegmentation" })).SegmentarAsync(foto, default));
await Error("BIO_SEGMENTACION_ERROR", () => Client("{\"resultado\":false,\"segmentado\":false}").SegmentarAsync(foto, default));
await Error("BIO_RESPUESTA_INVALIDA", () => Client("{\"resultado\":true,\"segmentado\":true,\"rostro\":\"\"}").SegmentarAsync(foto, default));
await Error("BIO_RESPUESTA_INVALIDA", () => Client("{\"resultado\":true,\"segmentado\":true,\"rostro\":\"invalid\"}").SegmentarAsync(foto, default));
await Error("BIO_IMAGEN_INVALIDA", () => { ImagenBiometrica.Leer("invalid"); return Task.CompletedTask; });
Check(ImagenBiometrica.Leer("data:image/jpeg;base64," + Convert.ToBase64String(foto)).SequenceEqual(foto), "Data URL");
await Error("BIO_USUARIO_NO_ENCONTRADO", () => { BiometriaService.ComprobarCuenta(null); return Task.CompletedTask; });
await Error("BIO_CUENTA_NO_HABILITADA", () => { BiometriaService.ComprobarCuenta(new(new Usuario { Activo = "N" }, null, null)); return Task.CompletedTask; });
await Error("BIO_CUENTA_NO_HABILITADA", () => { BiometriaService.ComprobarCuenta(new(new Usuario { Bloqueado = "S" }, null, null)); return Task.CompletedTask; });
var timeoutClient = new BiometriaClient(new HttpClient(new Handler((_, _) => throw new TaskCanceledException())),
    new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Biometria:BaseUrl"] = "https://example.invalid" }).Build());
await Error("BIO_TIMEOUT", () => timeoutClient.VerificarAsync(foto, foto, default));
// Identificación solo con cámara: nunca elegir la primera coincidencia sin revisar el resto.
UsuarioBiometrico Cuenta(long id) => new(new Usuario { IdUsuario = id, Nickname = "usuario" + id }, null, id);
var repo = new GaleriaFalsa { Candidatos = [Cuenta(1), Cuenta(2)], Actual = Cuenta(2) };
var proveedor = new ProveedorFalso { Coinciden = [2] };
var servicio = new BiometriaService(repo, proveedor, null!);
var identificado = await servicio.IdentificarAsync(Convert.ToBase64String(foto), default);
Check(identificado.IdUsuario == 2, "Identifica la cuenta sin correo");
Check(proveedor.Segmentaciones == 1 && proveedor.Comparaciones == 2, "Segmenta una vez y comprueba toda la galería");
proveedor.Coinciden = [];
await Error("BIO_NO_COINCIDE", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
proveedor.Coinciden = [1, 2];
await Error("BIO_COINCIDENCIA_AMBIGUA", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
proveedor.Coinciden = [1]; proveedor.FalloEn = 2;
await Error("BIO_PROVEEDOR_HTTP", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
proveedor.FalloEn = null; proveedor.Coinciden = [2];
repo.Actual = new(new Usuario { IdUsuario = 2, Bloqueado = "S" }, null, 2);
await Error("BIO_CUENTA_NO_HABILITADA", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
repo.Actual = new(new Usuario { IdUsuario = 2 }, null, 3);
await Error("BIO_CUENTA_CAMBIO", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
repo.Candidatos = [];
await Error("BIO_SIN_REFERENCIA", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));
repo.Candidatos = Enumerable.Range(1, 101).Select(x => Cuenta(x)).ToArray();
await Error("BIO_GALERIA_LIMITE", () => servicio.IdentificarAsync(Convert.ToBase64String(foto), default));

Console.WriteLine($"Biometria: {pruebas} comprobaciones correctas. Sin enviar imágenes ni modificar usuarios.");

sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request, ct);
}

sealed class GaleriaFalsa : IBiometriaRepository {
    public IReadOnlyList<UsuarioBiometrico> Candidatos { get; set; } = [];
    public UsuarioBiometrico? Actual { get; set; }
    public Task<UsuarioBiometrico?> BuscarAsync(string? identificador, long? id, CancellationToken ct) => Task.FromResult(Actual);
    public Task<IReadOnlyList<UsuarioBiometrico>> ListarReferenciasAsync(int limite, CancellationToken ct) => Task.FromResult(Candidatos);
    public Task<byte[]?> FotoAsync(long id, long usuario, CancellationToken ct) => Task.FromResult<byte[]?>([(byte)id]);
    public Task GuardarAsync(UsuarioBiometrico usuario, byte[] original, byte[] segmentada, CancellationToken ct) => throw new NotSupportedException();
}
sealed class ProveedorFalso : IBiometriaClient {
    public HashSet<byte> Coinciden { get; set; } = [];
    public byte? FalloEn { get; set; }
    public int Segmentaciones { get; private set; }
    public int Comparaciones { get; private set; }
    public Task<byte[]> SegmentarAsync(byte[] imagen, CancellationToken ct) { Segmentaciones++; return Task.FromResult(imagen); }
    public Task VerificarAsync(byte[] referencia, byte[] captura, CancellationToken ct) {
        Comparaciones++;
        if (referencia[0] == FalloEn) throw new BiometriaException("BIO_PROVEEDOR_HTTP", "Error", 502);
        if (!Coinciden.Contains(referencia[0])) throw new BiometriaException("BIO_NO_COINCIDE", "No coincide", 401);
        return Task.CompletedTask;
    }
}
