using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace FamKon_store_api.Services
{
    public class EmailService
    {
        private readonly string _smtpHost;
        private readonly int _smtpPuerto;
        private readonly string _email;
        private readonly string _password;
        private readonly string _remitente;
        private readonly string _from;
        private readonly bool _checkCertificateRevocation;
        private readonly ILogger<EmailService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger, IHttpClientFactory httpClientFactory)
        {
            _smtpHost = configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            _smtpPuerto = int.TryParse(configuration["Email:SmtpPort"], out var port) ? port : 587;
            _email = (configuration["Email:Address"] ?? string.Empty).Trim();
            _password = (configuration["Email:Password"] ?? string.Empty).Replace(" ", string.Empty);
            _remitente = configuration["Email:DisplayName"] ?? "FamKon";
            _from = (configuration["Email:From"] ?? _email).Trim();
            _checkCertificateRevocation = configuration.GetValue("Email:CheckCertificateRevocation", true);
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private bool EsBrevo => _smtpHost.Contains("brevo", StringComparison.OrdinalIgnoreCase);
        private bool UsarApiRest => EsBrevo && (_smtpPuerto == 443 || _smtpPuerto == 587);

        public async Task<bool> EnviarCodigoVerificacionAsync(string destino, string codigo, int minutosExpiracion = 5)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
            {
                _logger.LogError("Email no configurado (Email:Address / Email:Password)");
                return false;
            }

            var htmlBody = ConstruirHtmlVerificacion(codigo, minutosExpiracion);
            var textBody = ConstruirTextVerificacion(codigo, minutosExpiracion);

            return await EnviarAsync(destino, "Tu codigo de verificacion FamKon", htmlBody, textBody);
        }

        public async Task<(bool ok, string detalle)> EnviarCorreoTextoAsync(string destino, string asunto, string cuerpo)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
                return (false, "Email o password no configurados.");
            if (string.IsNullOrWhiteSpace(destino))
                return (false, "Destinatario vacío.");

            var ok = await EnviarAsync(destino, asunto, null, cuerpo);
            return ok ? (true, $"Correo enviado a {destino}") : (false, "Error al enviar correo.");
        }

        public async Task<(bool ok, string detalle)> ProbarConexionAsync()
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
                return (false, "Email o password no configurados.");

            if (UsarApiRest)
            {
                try
                {
                    var client = _httpClientFactory.CreateClient("BrevoApi");
                    using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
                    request.Headers.Add("api-key", _password);
                    request.Content = new StringContent("{\"sender\":{\"name\":\"Test\",\"email\":\"" + _from + "\"},\"to\":[{\"email\":\"" + _from + "\"}],\"subject\":\"Test\",\"htmlContent\":\"Test\"}", Encoding.UTF8, "application/json");
                    var response = await client.SendAsync(request);
                    var body = await response.Content.ReadAsStringAsync();
                    return response.IsSuccessStatusCode
                        ? (true, $"Conectado a Brevo API OK como {_email}")
                        : (false, $"Brevo API error: {response.StatusCode} - {body}");
                }
                catch (Exception ex)
                {
                    return (false, $"{ex.GetType().Name}: {ex.Message}");
                }
            }

            return (false, "Solo Brevo API soportado en este método.");
        }

        private async Task<bool> EnviarAsync(string destino, string asunto, string? htmlBody, string textBody)
        {
            try
            {
                if (UsarApiRest)
                {
                    return await EnviarViaBrevoApiAsync(destino, asunto, htmlBody, textBody);
                }
                else
                {
                    return await EnviarViaSmtpAsync(destino, asunto, htmlBody, textBody);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email a {Destino}: {Tipo} {Mensaje}", destino, ex.GetType().Name, ex.Message);
                return false;
            }
        }

        private async Task<bool> EnviarViaBrevoApiAsync(string destino, string asunto, string? htmlBody, string textBody)
        {
            var payload = new
            {
                sender = new { name = _remitente, email = _from },
                to = new[] { new { email = destino } },
                subject = asunto,
                htmlContent = htmlBody ?? $"<html><body><p>{textBody}</p></body></html>",
                textContent = textBody
            };

            var client = _httpClientFactory.CreateClient("BrevoApi");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.Add("api-key", _password);
            var jsonPayload = JsonSerializer.Serialize(payload);
            request.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            _logger.LogInformation("Enviando email via Brevo REST API a {Destino}. Payload: {Payload}", destino, jsonPayload);

            HttpResponseMessage response;
            try
            {
                response = await client.SendAsync(request);
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "HttpRequestException conectando a Brevo API: {Mensaje}", httpEx.Message);
                return false;
            }

            var responseBody = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Brevo API response: Status={Status} Body={Body}", response.StatusCode, responseBody);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Email enviado via Brevo API a {Destino}", destino);
                return true;
            }

            _logger.LogError("Brevo API error: Status={Status} Body={Body}", response.StatusCode, responseBody);
            return false;
        }

        private async Task<bool> EnviarViaSmtpAsync(string destino, string asunto, string? htmlBody, string textBody)
        {
            using var mailKit = new MailKit.Net.Smtp.SmtpClient { CheckCertificateRevocation = _checkCertificateRevocation };

            var mensaje = new MimeKit.MimeMessage();
            mensaje.From.Add(new MimeKit.MailboxAddress(_remitente, _from));
            mensaje.To.Add(MimeKit.MailboxAddress.Parse(destino));
            mensaje.Subject = asunto;

            if (!string.IsNullOrEmpty(htmlBody))
            {
                mensaje.Body = new MimeKit.BodyBuilder
                {
                    HtmlBody = htmlBody,
                    TextBody = textBody
                }.ToMessageBody();
            }
            else
            {
                mensaje.Body = new MimeKit.TextPart("plain") { Text = textBody };
            }

            var opciones = _smtpPuerto == 465
                ? MailKit.Security.SecureSocketOptions.SslOnConnect
                : MailKit.Security.SecureSocketOptions.StartTls;

            _logger.LogInformation("Conectando a {Host}:{Puerto} ({Opciones}) como {Email}", _smtpHost, _smtpPuerto, opciones, _email);

            await mailKit.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
            await mailKit.AuthenticateAsync(_email, _password);
            await mailKit.SendAsync(mensaje);
            await mailKit.DisconnectAsync(true);

            _logger.LogInformation("Email enviado via SMTP a {Destino}", destino);
            return true;
        }

        private string ConstruirHtmlVerificacion(string codigo, int minutosExpiracion) => $@"
<!DOCTYPE html>
<html lang='es'>
<head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#222222;font-size:14px;line-height:1.5;'>
  <div style='max-width:520px;margin:0 auto;padding:24px 20px;'>
    <p style='margin:0 0 4px 0;color:#666;font-size:12px;'>FamKon</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:8px 0 20px 0;'>
    <p style='margin:0 0 14px 0;'>Hola,</p>
    <p style='margin:0 0 14px 0;'>Tu codigo de verificacion para completar el registro en FamKon es:</p>
    <p style='margin:20px 0;padding:14px 18px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;font-family:Consolas,Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:6px;text-align:center;color:#111;'>{codigo}</p>
    <p style='margin:14px 0;color:#444;'>Este codigo expira en {minutosExpiracion} minutos.</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:24px 0 12px 0;'>
    <p style='margin:0;color:#999;font-size:11px;'>Este es un mensaje automatico.</p>
    <p style='margin:4px 0 0 0;color:#999;font-size:11px;'>&copy; FamKon</p>
  </div>
</body>
</html>";

        private string ConstruirTextVerificacion(string codigo, int minutosExpiracion) => $@"FamKon - Verificacion de cuenta

Hola,

Tu codigo de verificacion para completar el registro en FamKon es:

    {codigo}

Este codigo expira en {minutosExpiracion} minutos.

--
Este es un mensaje automatico.
(c) FamKon";
    }
}
