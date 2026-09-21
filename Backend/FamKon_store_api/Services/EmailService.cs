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
            mensaje.Subject = "Código de verificación - FamKon";

            var builder = new BodyBuilder
            {
                HtmlBody = $@"
<!DOCTYPE html>
<html lang='es'>
<head><meta charset='UTF-8'></head>
<body style='margin:0;padding:0;background:#fff7ed;font-family:Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#fff7ed;padding:32px 16px;'>
    <tr>
      <td align='center'>
        <table width='100%' style='max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.05);overflow:hidden;'>
          <tr>
            <td style='background:linear-gradient(135deg,#f59e0b,#ea580c);padding:24px;text-align:center;'>
              <h1 style='margin:0;color:#ffffff;font-size:28px;'>FamKon</h1>
              <p style='margin:4px 0 0;color:#fef3c7;font-size:14px;'>Tienda en línea</p>
            </td>
          </tr>
          <tr>
            <td style='padding:32px;'>
              <h2 style='margin:0 0 16px;color:#1e293b;font-size:22px;'>Verifica tu correo electrónico</h2>
              <p style='margin:0 0 24px;color:#475569;font-size:15px;line-height:1.5;'>
                Usa el siguiente código para completar tu registro en FamKon. No lo compartas con nadie.
              </p>
              <div style='background:#fef3c7;border:2px dashed #f59e0b;border-radius:12px;padding:24px;text-align:center;margin:16px 0;'>
                <div style='color:#92400e;font-size:14px;letter-spacing:2px;margin-bottom:8px;'>CÓDIGO DE VERIFICACIÓN</div>
                <div style='color:#7c2d12;font-size:42px;font-weight:bold;letter-spacing:10px;font-family:Consolas,monospace;'>{codigo}</div>
              </div>
              <p style='margin:24px 0 8px;color:#475569;font-size:14px;'>
                ⏱ Este código expira en <strong>{minutosExpiracion} minutos</strong>.
              </p>
              <p style='margin:8px 0 0;color:#94a3b8;font-size:13px;'>
                Si no solicitaste este código, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>
          <tr>
            <td style='background:#f8fafc;padding:16px;text-align:center;color:#94a3b8;font-size:12px;'>
              © {DateTime.UtcNow.Year} FamKon. Todos los derechos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>",
                TextBody = $"FamKon - Tu código de verificación es: {codigo}. Expira en {minutosExpiracion} minutos."
            };
            mensaje.Body = builder.ToMessageBody();
            return mensaje;
        }
    }
}
