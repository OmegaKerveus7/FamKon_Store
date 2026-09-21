using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace FamKon_store_api.Services
{
    public class EmailService
    {
        private readonly string _smtpHost;
        private readonly int _smtpPuerto;
        private readonly string _email;
        private readonly string _password;
        private readonly string _remitente;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _smtpHost = configuration["Email:SmtpHost"] ?? "smtp.gmail.com";
            _smtpPuerto = int.TryParse(configuration["Email:SmtpPort"], out var port) ? port : 587;
            _email = (configuration["Email:Address"] ?? string.Empty).Trim();
            _password = (configuration["Email:Password"] ?? string.Empty).Replace(" ", string.Empty);
            _remitente = configuration["Email:DisplayName"] ?? "FamKon";
            _logger = logger;
        }

        public async Task<bool> EnviarCodigoVerificacionAsync(string destino, string codigo, int minutosExpiracion = 5)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
            {
                _logger.LogError("Email no configurado (Email:Address / Email:Password)");
                return false;
            }

            var mensaje = ConstruirMensaje(destino, codigo, minutosExpiracion);

            try
            {
                using var client = new SmtpClient();

                var opciones = _smtpPuerto == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTlsWhenAvailable;

                _logger.LogInformation("Conectando a {Host}:{Puerto} ({Opciones}) como {Email} (password len={Len})",
                    _smtpHost, _smtpPuerto, opciones, _email, _password.Length);

                await client.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
                await client.AuthenticateAsync(_email, _password);
                await client.SendAsync(mensaje);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Email de verificación enviado a {Destino}", destino);
                return true;
            }
            catch (MailKit.Security.AuthenticationException authEx)
            {
                _logger.LogError(authEx,
                    "Fallo de autenticación SMTP para {Email}. Verifica que la App Password sea válida y que la cuenta tenga 2FA activo. Detalle: {Mensaje}",
                    _email, authEx.Message);
                return false;
            }
            catch (MailKit.Net.Smtp.SmtpCommandException smtpEx)
            {
                _logger.LogError(smtpEx,
                    "Comando SMTP rechazado por {Host}: Status={Status} Code={Code} Message={Mensaje}",
                    _smtpHost, smtpEx.StatusCode, smtpEx.ErrorCode, smtpEx.Message);
                return false;
            }
            catch (MailKit.Net.Smtp.SmtpProtocolException protoEx)
            {
                _logger.LogError(protoEx,
                    "Protocolo SMTP error con {Host}: {Mensaje}",
                    _smtpHost, protoEx.Message);
                return false;
            }
            catch (System.Net.Sockets.SocketException sockEx)
            {
                _logger.LogError(sockEx,
                    "No se pudo conectar a {Host}:{Puerto}. Error de red: {Mensaje}",
                    _smtpHost, _smtpPuerto, sockEx.Message);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inesperado enviando email a {Destino}: {Tipo} {Mensaje}",
                    destino, ex.GetType().Name, ex.Message);
                return false;
            }
        }

        public async Task<(bool ok, string detalle)> EnviarCorreoTextoAsync(string destino, string asunto, string cuerpo)
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
                return (false, "Email o password no configurados.");
            if (string.IsNullOrWhiteSpace(destino))
                return (false, "Destinatario vacío.");

            var mensaje = new MimeMessage();
            mensaje.From.Add(new MailboxAddress(_remitente, _email));
            mensaje.To.Add(MailboxAddress.Parse(destino));
            mensaje.Subject = asunto;
            mensaje.Body = new TextPart("plain") { Text = cuerpo };

            try
            {
                using var client = new SmtpClient();
                var opciones = _smtpPuerto == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTlsWhenAvailable;

                await client.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
                await client.AuthenticateAsync(_email, _password);
                await client.SendAsync(mensaje);
                await client.DisconnectAsync(true);

                _logger.LogInformation("Correo de prueba enviado a {Destino}", destino);
                return (true, $"Correo enviado a {destino}");
            }
            catch (MailKit.Security.AuthenticationException authEx)
            {
                return (false, $"AuthenticationException: {authEx.Message}");
            }
            catch (MailKit.Net.Smtp.SmtpCommandException smtpEx)
            {
                return (false, $"SmtpCommandException: Status={smtpEx.StatusCode} Code={smtpEx.ErrorCode} {smtpEx.Message}");
            }
            catch (MailKit.Net.Smtp.SmtpProtocolException protoEx)
            {
                return (false, $"SmtpProtocolException: {protoEx.Message}");
            }
            catch (System.Net.Sockets.SocketException sockEx)
            {
                return (false, $"SocketException: {sockEx.Message}");
            }
            catch (Exception ex)
            {
                return (false, $"{ex.GetType().Name}: {ex.Message}");
            }
        }

        public async Task<(bool ok, string detalle)> ProbarConexionAsync()
        {
            if (string.IsNullOrWhiteSpace(_email) || string.IsNullOrWhiteSpace(_password))
                return (false, "Email o password no configurados.");

            try
            {
                using var client = new SmtpClient();
                var opciones = _smtpPuerto == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTlsWhenAvailable;

                await client.ConnectAsync(_smtpHost, _smtpPuerto, opciones);
                await client.AuthenticateAsync(_email, _password);
                await client.DisconnectAsync(true);
                return (true, $"Conectado a {_smtpHost}:{_smtpPuerto} OK como {_email}");
            }
            catch (Exception ex)
            {
                return (false, $"{ex.GetType().Name}: {ex.Message}");
            }
        }

        private MimeMessage ConstruirMensaje(string destino, string codigo, int minutosExpiracion)
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(new MailboxAddress(_remitente, _email));
            mensaje.To.Add(MailboxAddress.Parse(destino));
            mensaje.Subject = "Tu codigo de verificacion FamKon";

            mensaje.Headers.Add("List-Unsubscribe", $"<mailto:{_email}?subject=unsubscribe>");
            mensaje.Headers.Add("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
            mensaje.Headers.Add("Auto-Submitted", "auto-generated");
            mensaje.Headers.Add("X-Mailer", "FamKon");
            mensaje.Headers.Add("X-Priority", "1");
            mensaje.Headers.Add("Importance", "High");

            var builder = new BodyBuilder
            {
                HtmlBody = $@"
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

    <p style='margin:14px 0;color:#444;'>Este codigo expira en {minutosExpiracion} minutos. Si no lo usas antes de ese tiempo, deberas solicitar uno nuevo.</p>
    <p style='margin:14px 0;color:#444;'>Si no solicitaste este codigo, puedes ignorar este mensaje.</p>

    <hr style='border:none;border-top:1px solid #dddddd;margin:24px 0 12px 0;'>
    <p style='margin:0;color:#999;font-size:11px;'>Este es un mensaje automatico, por favor no respondas a este correo.</p>
    <p style='margin:4px 0 0 0;color:#999;font-size:11px;'>&copy; FamKon</p>
  </div>
</body>
</html>",
                TextBody = $@"FamKon - Verificacion de cuenta

Hola,

Tu codigo de verificacion para completar el registro en FamKon es:

    {codigo}

Este codigo expira en {minutosExpiracion} minutos. Si no lo usas antes de ese tiempo, deberas solicitar uno nuevo.

Si no solicitaste este codigo, puedes ignorar este mensaje.

--
Este es un mensaje automatico, por favor no respondas a este correo.
(c) FamKon"
            };
            mensaje.Body = builder.ToMessageBody();
            return mensaje;
        }
    }
}
