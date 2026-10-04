using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MimeKit;

namespace FamKon_store_api.Services
{
    public class EmailService
    {
        private readonly string _provider;
        private readonly string _smtpHost;
        private readonly int _smtpPuerto;
        private readonly string _email;
        private readonly string _password;
        private readonly string _remitente;
        private readonly bool _checkCertificateRevocation;
        private readonly ILogger<EmailService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string? _brevoApiKey;
        private readonly string? _brevoFromEmail;
        private readonly string? _brevoFromName;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger, IHttpClientFactory httpClientFactory)
        {
            _provider = configuration["Email:Provider"] ?? "smtp";
            _smtpHost = configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            _smtpPuerto = int.TryParse(configuration["Email:SmtpPort"], out var port) ? port : 587;
            _email = (configuration["Email:Address"] ?? string.Empty).Trim();
            _password = (configuration["Email:Password"] ?? string.Empty).Replace(" ", string.Empty);
            _remitente = configuration["Email:DisplayName"] ?? "FamKon";
            _checkCertificateRevocation = configuration.GetValue("Email:CheckCertificateRevocation", true);
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _brevoApiKey = configuration["Brevo:ApiKey"];
            _brevoFromEmail = configuration["Brevo:FromEmail"] ?? _email;
            _brevoFromName = configuration["Brevo:FromName"] ?? _remitente;
        }

        public async Task<bool> EnviarCodigoVerificacionAsync(string destino, string codigo, int minutosExpiracion = 5, bool recuperacion = false)
        {
            var proposito = recuperacion ? "restablecer tu contraseña" : "completar el registro";
            var asunto = recuperacion ? "Recupera tu contraseña de FamKon" : "Tu código de verificación FamKon";
            var htmlBody = $@"
<!DOCTYPE html>
<html lang='es'>
<head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#222222;font-size:14px;line-height:1.5;'>
  <div style='max-width:520px;margin:0 auto;padding:24px 20px;'>
    <p style='margin:0 0 4px 0;color:#666;font-size:12px;'>FamKon</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:8px 0 20px 0;'>
    <p style='margin:0 0 14px 0;'>Hola,</p>
    <p style='margin:0 0 14px 0;'>Tu código de verificación para {proposito} en FamKon es:</p>
    <p style='margin:20px 0;padding:14px 18px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;font-family:Consolas,Courier New,monospace;font-size:24px;font-weight:bold;letter-spacing:6px;text-align:center;color:#111;'>{codigo}</p>
    <p style='margin:14px 0;color:#444;'>Este código expira en {minutosExpiracion} minutos. Si no lo usas antes de ese tiempo, deberás solicitar uno nuevo.</p>
    <p style='margin:14px 0;color:#444;'>Si no solicitaste este código, puedes ignorar este mensaje.</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:24px 0 12px 0;'>
    <p style='margin:0;color:#999;font-size:11px;'>Este es un mensaje automático, por favor no respondas a este correo.</p>
    <p style='margin:4px 0 0 0;color:#999;font-size:11px;'>&copy; FamKon</p>
  </div>
</body>
</html>";

            return await EnviarEmailAsync(destino, asunto, htmlBody);
        }

        public async Task<(bool ok, string detalle)> EnviarCorreoTextoAsync(string destino, string asunto, string cuerpo)
        {
            var htmlBody = $@"
<!DOCTYPE html>
<html lang='es'>
<head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#222222;font-size:14px;line-height:1.5;'>
  <div style='max-width:520px;margin:0 auto;padding:24px 20px;'>
    <p style='margin:0 0 4px 0;color:#666;font-size:12px;'>FamKon</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:8px 0 20px 0;'>
    <pre style='white-space:pre-wrap;word-wrap:break-word;'>{cuerpo}</pre>
    <hr style='border:none;border-top:1px solid #dddddd;margin:24px 0 12px 0;'>
    <p style='margin:0;color:#999;font-size:11px;'>Este es un mensaje automático, por favor no respondas a este correo.</p>
    <p style='margin:4px 0 0 0;color:#999;font-size:11px;'>&copy; FamKon</p>
  </div>
</body>
</html>";

            var ok = await EnviarEmailAsync(destino, asunto, htmlBody);
            return ok ? (true, $"Correo enviado a {destino}") : (false, "Error al enviar correo");
        }

        public async Task<(bool ok, string detalle)> ProbarConexionAsync()
        {
            if (_provider.Equals("brevo", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(_brevoApiKey))
                    return (false, "Brevo API Key no configurada.");
                return (true, $"Brevo configurado con {_brevoFromEmail}");
            }
            else
            {
                if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
                    return (false, "Email o password no configurados.");
                return (true, $"SMTP configurado con {_email}");
            }
        }

        public async Task<bool> EnviarConstanciaAsync(string destino, long pedido, byte[] pdf, bool credencial = false)
        {
            var asunto = credencial ? "FamKon - Tu credencial de acceso" : $"FamKon - Constancia del pedido {pedido}";
            var textoAdjunto = credencial
                ? "Adjuntamos tu credencial personal. Su QR permite entrar a tu cuenta; no lo compartas. Puedes reemplazarlo en Mi perfil."
                : "Adjuntamos tu constancia de compra. Escanea el QR del PDF para consultar el tracking e inicia sesión con tu cuenta.";

            var htmlBody = $@"
<!DOCTYPE html>
<html lang='es'>
<head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#222222;font-size:14px;line-height:1.5;'>
  <div style='max-width:520px;margin:0 auto;padding:24px 20px;'>
    <p style='margin:0 0 4px 0;color:#666;font-size:12px;'>FamKon</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:8px 0 20px 0;'>
    <p style='margin:0 0 14px 0;'>Hola,</p>
    <p style='margin:0 0 14px 0;'>{textoAdjunto}</p>
    <hr style='border:none;border-top:1px solid #dddddd;margin:24px 0 12px 0;'>
    <p style='margin:0;color:#999;font-size:11px;'>Este es un mensaje automático, por favor no respondas a este correo.</p>
    <p style='margin:4px 0 0 0;color:#999;font-size:11px;'>&copy; FamKon</p>
  </div>
</body>
</html>";

            return await EnviarEmailConAdjuntoAsync(destino, asunto, htmlBody, pdf, credencial ? "credencial-famkon.pdf" : $"constancia-{pedido}.pdf");
        }

        private async Task<bool> EnviarEmailAsync(string destino, string asunto, string htmlBody)
        {
            if (_provider.Equals("brevo", StringComparison.OrdinalIgnoreCase))
                return await EnviarConBrevoAsync(destino, asunto, htmlBody);
            else
                return await EnviarConSmtpAsync(destino, asunto, htmlBody);
        }

        private async Task<bool> EnviarEmailConAdjuntoAsync(string destino, string asunto, string htmlBody, byte[] pdf, string nombreArchivo)
        {
            if (_provider.Equals("brevo", StringComparison.OrdinalIgnoreCase))
                return await EnviarConBrevoAdjuntoAsync(destino, asunto, htmlBody, pdf, nombreArchivo);
            else
                return await EnviarConSmtpAdjuntoAsync(destino, asunto, htmlBody, pdf, nombreArchivo);
        }

        private async Task<bool> EnviarConBrevoAsync(string destino, string asunto, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(_brevoApiKey))
            {
                _logger.LogError("Brevo API Key no configurada (esta vacia o nula)");
                return false;
            }

            try
            {
                _logger.LogInformation("Intentando enviar email via Brevo a {Destino}. Desde: {FromEmail}", destino, _brevoFromEmail);

                var client = _httpClientFactory.CreateClient("BrevoApi");
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("api-key", _brevoApiKey);

                var payload = new
                {
                    sender = new { name = _brevoFromName, email = _brevoFromEmail },
                    to = new[] { new { email = destino } },
                    subject = asunto,
                    htmlContent = htmlBody
                };

                _logger.LogDebug("Payload Brevo: {Payload}", System.Text.Json.JsonSerializer.Serialize(payload));

                var response = await client.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", payload);

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("Respuesta Brevo: Status={StatusCode}, Body={Body}", response.StatusCode, responseContent);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Email enviado via Brevo a {Destino}", destino);
                    return true;
                }

                _logger.LogError("Error Brevo {StatusCode}: {Error}", response.StatusCode, responseContent);
                return false;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Error de conexion con Brevo: {Mensaje}. InnerException: {Inner}", ex.Message, ex.InnerException?.Message);
                return false;
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogError(ex, "Timeout esperando respuesta de Brevo: {Mensaje}", ex.Message);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email via Brevo a {Destino}: {Tipo} {Mensaje}", destino, ex.GetType().Name, ex.Message);
                return false;
            }
        }

        private async Task<bool> EnviarConBrevoAdjuntoAsync(string destino, string asunto, string htmlBody, byte[] pdf, string nombreArchivo)
        {
            if (string.IsNullOrWhiteSpace(_brevoApiKey))
            {
                _logger.LogError("Brevo API Key no configurada");
                return false;
            }

            try
            {
                var client = _httpClientFactory.CreateClient("BrevoApi");
                client.DefaultRequestHeaders.Clear();
                client.DefaultRequestHeaders.Add("api-key", _brevoApiKey);

                var base64Pdf = Convert.ToBase64String(pdf);

                var payload = new
                {
                    sender = new { name = _brevoFromName, email = _brevoFromEmail },
                    to = new[] { new { email = destino } },
                    subject = asunto,
                    htmlContent = htmlBody,
                    attachment = new[] { new { content = base64Pdf, name = nombreArchivo } }
                };

                var response = await client.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", payload);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Email con adjunto enviado via Brevo a {Destino}", destino);
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Error Brevo {StatusCode}: {Error}", response.StatusCode, errorContent);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email con adjunto via Brevo: {Mensaje}", ex.Message);
                return false;
            }
        }

        private async Task<bool> EnviarConSmtpAsync(string destino, string asunto, string htmlBody)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
            {
                _logger.LogError("Email no configurado (Email:Address / Email:Password)");
                return false;
            }

            try
            {
                using var client = CrearClienteSmtp();
                var opciones = _smtpPuerto == 465
                    ? MailKit.Security.SecureSocketOptions.SslOnConnect
                    : MailKit.Security.SecureSocketOptions.StartTls;

                await client.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
                await client.AuthenticateAsync(_email, _password);

                var mensaje = new MimeMessage();
                mensaje.From.Add(new MailboxAddress(_remitente, _email));
                mensaje.To.Add(MailboxAddress.Parse(destino));
                mensaje.Subject = asunto;
                mensaje.Body = new TextPart("html") { Text = htmlBody };

                await client.SendAsync(mensaje);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email enviado via SMTP a {Destino}", destino);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email via SMTP: {Mensaje}", ex.Message);
                return false;
            }
        }

        private async Task<bool> EnviarConSmtpAdjuntoAsync(string destino, string asunto, string htmlBody, byte[] pdf, string nombreArchivo)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
            {
                _logger.LogError("Email no configurado para enviar adjunto");
                return false;
            }

            try
            {
                using var client = CrearClienteSmtp();
                var opciones = _smtpPuerto == 465
                    ? MailKit.Security.SecureSocketOptions.SslOnConnect
                    : MailKit.Security.SecureSocketOptions.StartTls;

                await client.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
                await client.AuthenticateAsync(_email, _password);

                var mensaje = new MimeMessage();
                mensaje.From.Add(new MailboxAddress(_remitente, _email));
                mensaje.To.Add(MailboxAddress.Parse(destino));
                mensaje.Subject = asunto;

                var builder = new BodyBuilder { HtmlBody = htmlBody };
                builder.Attachments.Add(nombreArchivo, pdf, new ContentType("application", "pdf"));
                mensaje.Body = builder.ToMessageBody();

                await client.SendAsync(mensaje);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email con adjunto enviado via SMTP a {Destino}", destino);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email con adjunto via SMTP: {Mensaje}", ex.Message);
                return false;
            }
        }

        private MailKit.Net.Smtp.SmtpClient CrearClienteSmtp()
        {
            return new MailKit.Net.Smtp.SmtpClient { CheckCertificateRevocation = _checkCertificateRevocation };
        }
    }
}
