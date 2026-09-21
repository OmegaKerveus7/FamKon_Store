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

        private readonly EmailService _emailService;
        private readonly WhatsAppService _whatsAppService;
        private readonly ILogger<VerificacionController> _logger;

        public VerificacionController(
            EmailService emailService,
            WhatsAppService whatsAppService,
            ILogger<VerificacionController> logger)
        {
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

            var emailOk = false;
            var whatsOk = false;

            if (canal == CanalVerificacion.EMAIL || canal == CanalVerificacion.AMBOS)
            {
                emailOk = await _emailService.EnviarCodigoVerificacionAsync(request.Correo, request.Codigo, MinutosExpiracion);
            }

            if (canal == CanalVerificacion.WHATSAPP || canal == CanalVerificacion.AMBOS)
            {
                whatsOk = await _whatsAppService.EnviarCodigoVerificacionAsync(request.Telefono!, request.Codigo, MinutosExpiracion);
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
