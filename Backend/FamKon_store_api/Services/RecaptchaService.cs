using System.Text.Json;
using System.Text.Json.Serialization;

namespace FamKon_store_api.Services;

public interface IRecaptchaVerifier
{
    string? SiteKey { get; }
    Task Verificar(string? token, CancellationToken cancellationToken = default);
}

public sealed class RecaptchaException(string mensaje, int status) : Exception(mensaje)
{
    public int Status { get; } = status;
}

public sealed class RecaptchaService(HttpClient http, IConfiguration config, IHostEnvironment environment, ILogger<RecaptchaService> logger) : IRecaptchaVerifier
{
    private readonly string siteKey = (config["Recaptcha:SiteKey"] ?? "").Trim();
    private readonly string secretKey = (config["Recaptcha:SecretKey"] ?? "").Trim();
    private readonly string[] hosts = config.GetSection("Recaptcha:AllowedHostnames").Get<string[]>() ?? [];
    private bool Configurado => siteKey.Length > 0 && secretKey.Length > 0 && hosts.Any(h => !string.IsNullOrWhiteSpace(h)) &&
        (environment.IsDevelopment() || (siteKey != "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" && secretKey != "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"));
    // Solo la clave pública llega al navegador. Sin configuración no se permite comprar.
    public string? SiteKey => Configurado ? siteKey : null;

    public async Task Verificar(string? token, CancellationToken cancellationToken = default)
    {
        if (!Configurado) throw new RecaptchaException("La verificación de seguridad no está disponible. Intenta más tarde.", 503);
        if (string.IsNullOrWhiteSpace(token) || token.Length > 8192)
            throw new RecaptchaException("Completa la verificación «No soy un robot» antes de confirmar.", 400);
        try
        {
            using var content = new FormUrlEncodedContent(new Dictionary<string, string> { ["secret"] = secretKey, ["response"] = token });
            using var response = await http.PostAsync("https://www.google.com/recaptcha/api/siteverify", content, cancellationToken);
            if (!response.IsSuccessStatusCode) throw new RecaptchaException("No se pudo verificar reCAPTCHA. Intenta nuevamente.", 503);
            var result = await response.Content.ReadFromJsonAsync<GoogleResponse>(cancellationToken: cancellationToken);
            if (result is null) throw new RecaptchaException("No se pudo verificar reCAPTCHA. Intenta nuevamente.", 503);
            if (!result.Success)
            {
                // Registrar solo códigos conocidos del proveedor, nunca secretos ni tokens.
                string[] conocidos = ["missing-input-secret", "invalid-input-secret", "missing-input-response", "invalid-input-response", "bad-request", "timeout-or-duplicate"];
                var errores = (result.ErrorCodes ?? []).Where(c => conocidos.Contains(c)).Distinct().ToArray();
                logger.LogWarning("reCAPTCHA rechazado por Google. Códigos: {Codigos}", errores.Length > 0 ? string.Join(", ", errores) : "sin-codigo-conocido");
                if (errores.Contains("missing-input-secret") || errores.Contains("invalid-input-secret"))
                    throw new RecaptchaException("La configuración de reCAPTCHA del servidor no es válida. Contacta al administrador.", 503);
                if (errores.Contains("bad-request"))
                    throw new RecaptchaException("No se pudo procesar la verificación de seguridad. Intenta más tarde.", 503);
                if (errores.Contains("timeout-or-duplicate"))
                    throw new RecaptchaException("La verificación venció o ya se utilizó. Marca nuevamente «No soy un robot» y confirma el pedido.", 400);
                throw new RecaptchaException("Google rechazó la verificación. Completa reCAPTCHA nuevamente; si persiste, contacta al administrador.", 400);
            }
            if (string.IsNullOrWhiteSpace(result.Hostname) || !hosts.Any(h => string.Equals(h.Trim(), result.Hostname, StringComparison.OrdinalIgnoreCase)))
                throw new RecaptchaException("La verificación de seguridad no corresponde a este sitio.", 400);
            // challenge_ts es la carga del desafío, no la emisión de la respuesta.
            // Google comprueba la caducidad y el uso único del token en siteverify.
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new RecaptchaException("La verificación tardó demasiado. Intenta nuevamente.", 503);
        }
        catch (HttpRequestException)
        {
            logger.LogWarning("No fue posible contactar al servicio reCAPTCHA");
            throw new RecaptchaException("No se pudo conectar con la verificación de seguridad. Intenta nuevamente.", 503);
        }
        catch (JsonException)
        {
            logger.LogWarning("Respuesta reCAPTCHA inválida");
            throw new RecaptchaException("No se pudo verificar reCAPTCHA. Intenta nuevamente.", 503);
        }
    }

    private sealed class GoogleResponse
    {
        [JsonPropertyName("success")] public bool Success { get; set; }
        [JsonPropertyName("hostname")] public string? Hostname { get; set; }
        [JsonPropertyName("error-codes")] public string[]? ErrorCodes { get; set; }
    }
}
