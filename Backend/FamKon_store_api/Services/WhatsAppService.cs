using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace FamKon_store_api.Services
{
    public class WhatsAppService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiUrl;
        private readonly string _instanceId;
        private readonly string _accessToken;
        private readonly string _defaultCountryCode;
        private readonly ILogger<WhatsAppService> _logger;

        public WhatsAppService(HttpClient httpClient, IConfiguration configuration, ILogger<WhatsAppService> logger)
        {
            _httpClient = httpClient;
            _apiUrl = (configuration["WhatsApp:ApiUrl"] ?? "https://api.wawp.net/v2").TrimEnd('/');
            _instanceId = configuration["WhatsApp:InstanceId"] ?? string.Empty;
            _accessToken = configuration["WhatsApp:AccessToken"] ?? string.Empty;
            _defaultCountryCode = configuration["WhatsApp:DefaultCountryCode"] ?? "502";
            _logger = logger;
        }

        public async Task<bool> EnviarCodigoVerificacionAsync(string telefono, string codigo, int minutosExpiracion = 5, bool recuperacion = false)
        {
            if (string.IsNullOrWhiteSpace(_instanceId) || string.IsNullOrWhiteSpace(_accessToken))
            {
                _logger.LogError("WhatsApp (WAWP) no configurado (WhatsApp:InstanceId / WhatsApp:AccessToken)");
                return false;
            }

            try
            {
                var chatId = FormatearChatId(telefono);
                var mensaje =
                    $"*FamKon - Código de verificación*\n\n" +
                    $"Tu código para {(recuperacion ? "restablecer tu contraseña" : "completar el registro")} es:\n\n" +
                    $"*{codigo}*\n\n" +
                    $"⏱ Expira en {minutosExpiracion} minutos.\n" +
                    $"No lo compartas con nadie.";

                var payload = new
                {
                    instance_id = _instanceId,
                    access_token = _accessToken,
                    chatId,
                    message = mensaje
                };

                var json = JsonSerializer.Serialize(payload);
                using var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var response = await _httpClient.PostAsync($"{_apiUrl}/send/text", content);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Error WAWP enviando a {Telefono} (chatId={ChatId}): {Status} {Error}",
                        telefono, chatId, response.StatusCode, errorBody);
                    return false;
                }

                _logger.LogInformation("WhatsApp (WAWP) enviado a {Telefono} (chatId={ChatId})", telefono, chatId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando WhatsApp (WAWP) a {Telefono}", telefono);
                return false;
            }
        }

        public async Task<bool> EnviarConstanciaAsync(string telefono, long pedido, string pdfUrl, bool credencial = false)
        {
            try {
                using var content = JsonContent.Create(new Dictionary<string,string> {
                    ["instance_id"] = _instanceId, ["access_token"] = _accessToken,
                    ["chatId"] = FormatearChatId(telefono), ["file[url]"] = pdfUrl,
                    ["file[filename]"] = credencial ? "credencial-famkon.pdf" : $"constancia-{pedido}.pdf", ["file[mimetype]"] = "application/pdf",
                    ["caption"] = credencial ? "FamKon - Tu credencial personal. Este QR permite entrar a tu cuenta; no lo compartas." : $"FamKon - Pedido {pedido}. Escanea el QR para consultar el tracking.", ["reply_to"] = ""
                });
                using var response = await _httpClient.PostAsync($"{_apiUrl}/send/pdf", content);
                if (!response.IsSuccessStatusCode) return false;
                using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
                var root = result.RootElement;
                if (root.TryGetProperty("success", out var success) && success.ValueKind == JsonValueKind.False) return false;
                if (root.TryGetProperty("status", out var status) && status.ToString() is "error" or "false") return false;
                return root.TryGetProperty("id", out var messageId) && messageId.ValueKind == JsonValueKind.Object && messageId.TryGetProperty("id", out var id) && !string.IsNullOrWhiteSpace(id.GetString());
            } catch { _logger.LogWarning("No se pudo enviar constancia del pedido {Pedido} por WhatsApp", pedido); return false; }
        }

        private string FormatearChatId(string telefono)
        {
            var soloDigitos = Regex.Replace(telefono ?? string.Empty, @"\D+", string.Empty);

            if (string.IsNullOrEmpty(soloDigitos))
                throw new ArgumentException("Teléfono vacío o sin dígitos.", nameof(telefono));

            if (!(telefono ?? string.Empty).TrimStart().StartsWith('+') && !string.IsNullOrEmpty(_defaultCountryCode) &&
                !soloDigitos.StartsWith(_defaultCountryCode))
            {
                soloDigitos = _defaultCountryCode + soloDigitos;
            }

            return $"{soloDigitos}@c.us";
        }
    }
}
