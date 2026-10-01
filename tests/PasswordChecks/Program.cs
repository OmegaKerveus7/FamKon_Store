using System.Text.Json;
using FamKon_store_api.Services;
using Microsoft.Extensions.Configuration;

var checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; }
async Task Rechaza(Func<Task> action, string label) {
    try { await action(); } catch (PasswordFlowException) { checks++; return; }
    throw new Exception(label);
}
var clock = new TestClock();
var store = new FakeStore();
var sender = new FakeSender();
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:SecretKey"] = "test-only-password-recovery-key-32-characters" }).Build();
var service = new PasswordRecoveryService(store, sender, config, clock);
async Task<(string solicitud, string permiso)> Verificado() {
    clock.Now = clock.Now.AddHours(2);
    var solicitud = await service.Solicitar("comprador", "EMAIL");
    var permiso = await service.Verificar(solicitud, sender.Code);
    return (solicitud, permiso);
}

var absent = await service.Solicitar("desconocido", "EMAIL");
Check(absent.Length == 64 && sender.Count == 0, "Una cuenta desconocida no envía códigos ni revela su existencia");
await Rechaza(() => service.Verificar(absent, "123456"), "No aceptar solicitudes inventadas");
var solicitud = await service.Solicitar("comprador", "WHATSAPP");
Check(sender.Channel == "WHATSAPP" && sender.Account!.Telefono == "+50245678901", "WhatsApp utiliza el teléfono de la BD");
Check(sender.Code.Length == 6 && sender.Code.All(char.IsAsciiDigit), "Código numérico de seis dígitos");
Check(!JsonSerializer.Serialize(store.State).Contains(sender.Code), "No persistir OTP en claro");
var code = sender.Code;
var throttled = await service.Solicitar("comprador", "EMAIL");
Check(sender.Count == 1 && throttled != solicitud, "Cooldown por cuenta entre canales");
Check(store.State.Solicitud == solicitud, "Una solicitud limitada no invalida el código anterior");
for (int i = 0; i < 5; i++) await Rechaza(() => service.Verificar(solicitud, code == "000000" ? "000001" : "000000"), "Rechazar código incorrecto");
await Rechaza(() => service.Verificar(solicitud, code), "Cinco fallos bloquean también el código correcto");

clock.Now = clock.Now.AddMinutes(2);
solicitud = await service.Solicitar("comprador", "EMAIL");
clock.Now = clock.Now.AddMinutes(5);
await Rechaza(() => service.Verificar(solicitud, sender.Code), "El código vence exactamente a los cinco minutos");
var good = await Verificado();
await Rechaza(() => service.Verificar(good.solicitud, sender.Code), "El código no se verifica dos veces");
await Rechaza(() => service.Restablecer(good.solicitud, new string('0', 64), "NuevaClave2"), "No aceptar autorización inventada");
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "corta"), "Aplicar política de contraseña en servidor");
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "ClaveActual1"), "No reutilizar contraseña anterior");
Check(await service.Restablecer(good.solicitud, good.permiso, "NuevaClave2") == 7, "Recuperar la cuenta correcta");
Check(LoginService.ValidarPassword("NuevaClave2", store.Account.Hash), "Guardar hash compatible con login");
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "OtraClave3"), "No reutilizar permiso consumido");

good = await Verificado();
clock.Now = clock.Now.AddMinutes(5);
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "OtraClave3"), "El permiso de cambio también vence");
good = await Verificado();
await Rechaza(() => service.Cambiar(7, "Incorrecta", "OtraClave3"), "El perfil exige contraseña actual");
await service.Cambiar(7, "NuevaClave2", "OtraClave3");
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "TerceraClave4"), "Un cambio invalida la recuperación pendiente");
Check(LoginService.ValidarPassword("OtraClave3", store.Account.Hash), "Cambio desde el perfil aplicado");
for (int i = 0; i < 5; i++) await Rechaza(() => service.Cambiar(7, "Incorrecta", "TerceraClave4"), "Limitar fallos de contraseña actual");
await Rechaza(() => service.Cambiar(7, "OtraClave3", "TerceraClave4"), "Límite por cuenta incluso con contraseña correcta");
clock.Now = clock.Now.AddMinutes(15);
await service.Cambiar(7, "OtraClave3", "TerceraClave4");
Check(LoginService.ValidarPassword("TerceraClave4", store.Account.Hash), "La ventana de intentos se restablece");

clock.Now = clock.Now.AddHours(2);
solicitud = await service.Solicitar("comprador", "EMAIL");
code = sender.Code;
clock.Now = clock.Now.AddMinutes(1);
var replacement = await service.Solicitar("comprador", "EMAIL");
await Rechaza(() => service.Verificar(solicitud, code), "Reenviar invalida el código anterior");
Check(replacement != solicitud, "Cada solicitud tiene identificador aleatorio");
for (int i = 0; i < 3; i++) { clock.Now = clock.Now.AddMinutes(1); await service.Solicitar("comprador", "EMAIL"); }
var sent = sender.Count;
clock.Now = clock.Now.AddMinutes(1);
await service.Solicitar("comprador", "WHATSAPP");
Check(sender.Count == sent, "Máximo cinco envíos por hora y cuenta");

clock.Now = clock.Now.AddHours(2);
sender.Success = false;
solicitud = await service.Solicitar("comprador", "EMAIL");
await Rechaza(() => service.Verificar(solicitud, sender.Code), "Un envío fallido no deja OTP utilizable");
sender.Success = true;
good = await Verificado();
store.Account = store.Account with { Habilitado = false };
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "CuartaClave5"), "Revisar estado de cuenta al aplicar cambio");
await Rechaza(() => service.Cambiar(7, "TerceraClave4", "CuartaClave5"), "Cuenta deshabilitada no cambia contraseña");
sent = sender.Count;
await service.Solicitar("comprador", "EMAIL");
Check(sender.Count == sent, "No enviar a cuentas deshabilitadas");
store.Account = store.Account with { Habilitado = true };
good = await Verificado();
store.Account = store.Account with { Hash = LoginService.Sha256LowerHex("CambiadaExternamente1") };
await Rechaza(() => service.Restablecer(good.solicitud, good.permiso, "CuartaClave5"), "Un cambio externo invalida el permiso pendiente");

good = await Verificado();
var simultaneous = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ => {
    try { await service.Restablecer(good.solicitud, good.permiso, "UltimaClave6"); return true; }
    catch (PasswordFlowException) { return false; }
}));
Check(simultaneous.Count(x => x) == 1, "Dos consumos concurrentes permiten un solo cambio");
Console.WriteLine($"PASS: {checks} comprobaciones de recuperación y cambio de contraseña (sin Oracle ni envíos reales).");

sealed class TestClock : TimeProvider {
    public DateTimeOffset Now = new(2026, 9, 29, 12, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
sealed class FakeSender : IPasswordCodeSender {
    public string Code = ""; public string Channel = ""; public PasswordAccount? Account; public int Count; public bool Success = true;
    public Task<bool> Send(PasswordAccount account, string canal, string codigo) { Account = account; Code = codigo; Channel = canal; Count++; return Task.FromResult(Success); }
}
sealed class FakeStore : IPasswordRecoveryStore {
    public PasswordAccount Account = new(7, "comprador@example.com", "+50245678901", LoginService.Sha256LowerHex("ClaveActual1"), true);
    public PasswordRecoveryState State = new();
    private readonly SemaphoreSlim gate = new(1);
    public async Task<IPasswordRecoverySession?> Open(string? identificador = null, long? usuario = null, string? solicitud = null) {
        await gate.WaitAsync();
        if (usuario == 7 || solicitud is not null && solicitud == State.Solicitud || identificador == "comprador") return new Session(this);
        gate.Release(); return null;
    }
    sealed class Session(FakeStore store) : IPasswordRecoverySession {
        public PasswordAccount Account { get; } = store.Account;
        public PasswordRecoveryState State { get; } = JsonSerializer.Deserialize<PasswordRecoveryState>(JsonSerializer.Serialize(store.State))!;
        public Task Commit(string? nuevoHash = null) { store.State = State; if (nuevoHash is not null) store.Account = store.Account with { Hash = nuevoHash }; return Task.CompletedTask; }
        public void Dispose() => store.gate.Release();
    }
}
