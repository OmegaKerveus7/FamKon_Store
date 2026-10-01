using System.Security.Cryptography;
using System.Text;

namespace FamKon_store_api.Services;

public interface IPasswordCodeSender
{
    Task<bool> Send(PasswordAccount account, string canal, string codigo);
}

public sealed class PasswordCodeSender(EmailService email, WhatsAppService whatsapp) : IPasswordCodeSender
{
    public Task<bool> Send(PasswordAccount account, string canal, string codigo) => canal == "EMAIL"
        ? email.EnviarCodigoVerificacionAsync(account.Correo, codigo, 5, recuperacion: true)
        : whatsapp.EnviarCodigoVerificacionAsync(account.Telefono, codigo, 5, recuperacion: true);
}

public sealed class PasswordFlowException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed class PasswordRecoveryService(IPasswordRecoveryStore store, IPasswordCodeSender sender, IConfiguration config, TimeProvider clock)
{
    public const string MensajeSolicitud = "Si la cuenta está habilitada y tiene ese medio registrado, recibirás un código. Revisa también la carpeta de spam. Puedes solicitar otro en un minuto.";
    private const string CodigoInvalido = "El código no es válido, venció o alcanzó el límite de intentos. Solicita uno nuevo.";
    private readonly byte[] key = Encoding.UTF8.GetBytes(config["Jwt:SecretKey"] ?? throw new InvalidOperationException("Falta configurar Jwt:SecretKey."));
    private static string Token() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    private string Hash(string solicitud, string secreto) => Convert.ToHexString(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"password-recovery:{solicitud}:{secreto}")));
    private static bool Igual(string? a, string b) => a is not null && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    public async Task<string> Solicitar(string identificador, string canal, long? usuario = null)
    {
        if (canal is not ("EMAIL" or "WHATSAPP")) throw new PasswordFlowException("Selecciona correo electrónico o WhatsApp.");
        var solicitud = Token();
        var codigo = RandomNumberGenerator.GetInt32(1000000).ToString("D6");
        PasswordAccount account;
        using (var session = await store.Open(identificador: identificador.Trim(), usuario: usuario))
        {
            // Respuesta indistinguible para cuentas ausentes, bloqueadas o sin canal disponible.
            if (session is null || !session.Account.Habilitado) return solicitud;
            account = session.Account;
            if (canal == "EMAIL" ? !RegistroValidacion.CorreoValido(account.Correo) : !RegistroValidacion.TelefonoValido(account.Telefono)) return solicitud;
            var state = session.State;
            var now = clock.GetUtcNow();
            if (now - state.UltimoEnvio < TimeSpan.FromMinutes(1)) return solicitud;
            if (now - state.VentanaEnvios >= TimeSpan.FromHours(1)) { state.VentanaEnvios = now; state.Envios = 0; }
            if (state.Envios >= 5) return solicitud;
            state.Envios++;
            state.UltimoEnvio = now;
            state.Solicitud = solicitud;
            state.SecretoHash = Hash(solicitud, codigo);
            state.PasswordAnteriorHash = account.Hash;
            state.Expira = now.AddMinutes(5);
            state.Intentos = 0;
            state.Etapa = "ENVIANDO";
            await session.Commit();
        }
        // No mantener bloqueada la cuenta durante una llamada al proveedor externo.
        var enviado = await sender.Send(account, canal, codigo);
        using (var session = await store.Open(usuario: account.Id))
        {
            if (session is not null && session.State.Solicitud == solicitud && session.State.Etapa == "ENVIANDO")
            {
                if (enviado) session.State.Etapa = "CODIGO";
                else session.State.Cerrar();
                await session.Commit();
            }
        }
        return solicitud;
    }

    public async Task<string> Verificar(string solicitud, string codigo, long? usuario = null)
    {
        using var session = await store.Open(solicitud: solicitud);
        if (session is null || (usuario.HasValue && session.Account.Id != usuario)) throw new PasswordFlowException(CodigoInvalido);
        var state = session.State;
        if (!Valido(session, solicitud, "CODIGO") || state.Intentos >= 5) throw new PasswordFlowException(CodigoInvalido);
        state.Intentos++;
        if (!Igual(state.SecretoHash, Hash(solicitud, codigo)))
        {
            if (state.Intentos >= 5) state.Cerrar();
            await session.Commit(); // Persistir el fallo; no se revierte al rechazar la petición.
            throw new PasswordFlowException(CodigoInvalido);
        }
        var permiso = Token();
        state.Etapa = "VERIFICADO";
        state.SecretoHash = Hash(solicitud, permiso);
        state.Expira = clock.GetUtcNow().AddMinutes(5);
        await session.Commit();
        return permiso;
    }

    public async Task<long> Restablecer(string solicitud, string permiso, string nueva, long? usuario = null)
    {
        ValidarNueva(nueva);
        using var session = await store.Open(solicitud: solicitud);
        if (session is null || (usuario.HasValue && session.Account.Id != usuario) || !Valido(session, solicitud, "VERIFICADO") || !Igual(session.State.SecretoHash, Hash(solicitud, permiso)))
            throw new PasswordFlowException("La autorización venció o ya fue utilizada. Solicita otro código.");
        if (LoginService.ValidarPassword(nueva, session.Account.Hash)) throw new PasswordFlowException("La nueva contraseña debe ser diferente de la anterior.");
        session.State.Cerrar();
        await session.Commit(LoginService.Sha256LowerHex(nueva));
        return session.Account.Id;
    }

    public async Task Cambiar(long usuario, string actual, string nueva)
    {
        ValidarNueva(nueva);
        using var session = await store.Open(usuario: usuario);
        if (session is null || !session.Account.Habilitado) throw new PasswordFlowException("No se puede cambiar la contraseña de esta cuenta.", 403);
        var state = session.State;
        var now = clock.GetUtcNow();
        if (now - state.VentanaCambios >= TimeSpan.FromMinutes(15)) { state.VentanaCambios = now; state.IntentosCambio = 0; }
        if (state.IntentosCambio >= 5) throw new PasswordFlowException("Demasiados intentos. Espera 15 minutos o recupera con un código.", 429);
        if (!LoginService.ValidarPassword(actual, session.Account.Hash))
        {
            state.IntentosCambio++;
            await session.Commit();
            throw new PasswordFlowException("La contraseña actual no es correcta.");
        }
        if (actual == nueva) throw new PasswordFlowException("La nueva contraseña debe ser diferente de la anterior.");
        state.IntentosCambio = 0;
        state.Cerrar();
        await session.Commit(LoginService.Sha256LowerHex(nueva));
    }

    private bool Valido(IPasswordRecoverySession session, string solicitud, string etapa) =>
        session.Account.Habilitado && session.State.Solicitud == solicitud && session.State.Etapa == etapa &&
        session.State.Expira > clock.GetUtcNow() && session.State.PasswordAnteriorHash == session.Account.Hash;

    private static void ValidarNueva(string nueva)
    {
        if (!RegistroValidacion.PasswordValido(nueva)) throw new PasswordFlowException(RegistroValidacion.ReglaPassword);
    }
}
