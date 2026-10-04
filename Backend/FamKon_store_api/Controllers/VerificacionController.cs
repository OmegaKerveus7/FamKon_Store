using FamKon_store_api.Models.DTOs;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class VerificacionController : ControllerBase
    {
        private const int MinutosExpiracion = 5;

        private readonly UsuarioService _usuarioService;
        private readonly EmailService _emailService;
        private readonly WhatsAppService _whatsAppService;
        private readonly ILogger<VerificacionController> _logger;

        public VerificacionController(
            UsuarioService usuarioService,
            EmailService emailService,
            WhatsAppService whatsAppService,
            ILogger<VerificacionController> logger)
        {
            _usuarioService = usuarioService;
            _emailService = emailService;
            _whatsAppService = whatsAppService;
            _logger = logger;
        }

        [HttpPost("verificacion/enviar-codigo")]
        public async Task<ActionResult<EnviarCodigoResponse>> EnviarCodigo([FromBody] EnviarCodigoRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Codigo) || request.Codigo.Length != 6 || !request.Codigo.All(char.IsDigit))
            {
                return Ok(new EnviarCodigoResponse
                {
                    CodigoS = 400,
                    Mensaje = "El código debe ser numérico de 6 dígitos."
                });
            }

            if (!Enum.TryParse<CanalVerificacion>(request.Canal, ignoreCase: true, out var canal))
            {
                return Ok(new EnviarCodigoResponse
                {
                    CodigoS = 400,
                    Mensaje = "Canal inválido. Use EMAIL, WHATSAPP o AMBOS."
                });
            }

            if ((canal == CanalVerificacion.EMAIL || canal == CanalVerificacion.AMBOS)
                && string.IsNullOrWhiteSpace(request.Correo))
            {
                return Ok(new EnviarCodigoResponse
                {
                    CodigoS = 400,
                    Mensaje = "El correo es obligatorio para el canal EMAIL."
                });
            }

            if ((canal == CanalVerificacion.WHATSAPP || canal == CanalVerificacion.AMBOS)
                && string.IsNullOrWhiteSpace(request.Telefono))
            {
                return Ok(new EnviarCodigoResponse
                {
                    CodigoS = 400,
                    Mensaje = "El teléfono es obligatorio para el canal WHATSAPP."
                });
            }

            if (!RegistroValidacion.CorreoValido(request.Correo))
                return Ok(new EnviarCodigoResponse { CodigoS = 400, Mensaje = "Ingresa un correo válido." });
            if ((canal == CanalVerificacion.WHATSAPP || canal == CanalVerificacion.AMBOS) &&
                !RegistroValidacion.TelefonoValido(request.Telefono))
                return Ok(new EnviarCodigoResponse { CodigoS = 400, Mensaje = "Ingresa un teléfono válido con código de país (ej. +502 4567 8901)." });

            try
            {
                if (await _usuarioService.CorreoExisteAsync(request.Correo))
                    return Ok(new EnviarCodigoResponse { CodigoS = 409, Mensaje = "Este correo ya está registrado. Inicia sesión o utiliza otro correo." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error comprobando correo antes de enviar código");
                return Ok(new EnviarCodigoResponse { CodigoS = 503, Mensaje = "No se pudo comprobar el correo. Intenta de nuevo." });
            }
            request.Correo = request.Correo.Trim().ToLowerInvariant();
            request.Telefono = RegistroValidacion.NormalizarTelefono(request.Telefono);

            bool emailOk = false;
            bool whatsOk = false;

            try
            {
                // Ambos envíos empiezan juntos: un SMTP lento no bloquea WhatsApp.
                var emailTask = canal == CanalVerificacion.EMAIL || canal == CanalVerificacion.AMBOS
                    ? _emailService.EnviarCodigoVerificacionAsync(request.Correo, request.Codigo, MinutosExpiracion)
                    : Task.FromResult(false);
                var whatsTask = canal == CanalVerificacion.WHATSAPP || canal == CanalVerificacion.AMBOS
                    ? _whatsAppService.EnviarCodigoVerificacionAsync(request.Telefono!, request.Codigo, MinutosExpiracion)
                    : Task.FromResult(false);
                await Task.WhenAll(emailTask, whatsTask);
                emailOk = await emailTask;
                whatsOk = await whatsTask;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando código de verificación. EmailOk={EmailOk}, WhatsOk={WhatsOk}", emailOk, whatsOk);
                return Ok(new EnviarCodigoResponse { CodigoS = 500, Mensaje = "No se pudo enviar el código OTP. Revisa los logs del backend." });
            }

            var canalesFallidos = new List<string>();
            if ((canal == CanalVerificacion.EMAIL || canal == CanalVerificacion.AMBOS) && !emailOk)
                canalesFallidos.Add("correo");
            if ((canal == CanalVerificacion.WHATSAPP || canal == CanalVerificacion.AMBOS) && !whatsOk)
                canalesFallidos.Add("WhatsApp");

            if (canalesFallidos.Count > 0)
            {
                _logger.LogWarning("Falló envío de código por: {Canales}", string.Join(", ", canalesFallidos));
                return Ok(new EnviarCodigoResponse
                {
                    CodigoS = 502,
                    Mensaje = $"No se pudo enviar el código por: {string.Join(", ", canalesFallidos)}. Verifica los datos e intenta de nuevo.",
                    EmailEnviado = emailOk,
                    WhatsAppEnviado = whatsOk,
                    MinutosExpiracion = MinutosExpiracion
                });
            }

            return Ok(new EnviarCodigoResponse
            {
                CodigoS = 200,
                Mensaje = $"Código enviado correctamente. Tiene {MinutosExpiracion} minutos de expiración.",
                EmailEnviado = emailOk,
                WhatsAppEnviado = whatsOk,
                MinutosExpiracion = MinutosExpiracion
            });
        }

        [HttpGet("verificacion/test-email")]
        public async Task<ActionResult> ProbarEmail()
        {
            var (ok, detalle) = await _emailService.ProbarConexionAsync();
            return Ok(new
            {
                codigoS = ok ? 200 : 500,
                mensaje = detalle
            });
        }
    }
}
