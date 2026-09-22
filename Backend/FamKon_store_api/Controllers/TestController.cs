using FamKon_store_api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon/test")]
    public class TestController : ControllerBase
    {
        private readonly EmailService _emailService;
        private readonly ILogger<TestController> _logger;

        public TestController(EmailService emailService, ILogger<TestController> logger)
        {
            _emailService = emailService;
            _logger = logger;
        }

        public class EnviarCorreoTestRequest
        {
            public string Correo { get; set; } = string.Empty;
            public string? Asunto { get; set; }
            public string? Mensaje { get; set; }
        }

        public class EnviarCodigoTestRequest
        {
            public string Correo { get; set; } = string.Empty;
            public string? Codigo { get; set; }
        }

        [HttpPost("enviar-correo")]
        public async Task<ActionResult> EnviarCorreo([FromBody] EnviarCorreoTestRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo))
                return Ok(new { codigoS = 400, mensaje = "El campo 'correo' es obligatorio." });

            var asunto = string.IsNullOrWhiteSpace(request.Asunto)
                ? "Prueba de envío - FamKon"
                : request.Asunto;

            var cuerpo = string.IsNullOrWhiteSpace(request.Mensaje)
                ? $"Hola,\n\nEste es un correo de prueba enviado desde FamKon API.\n\n" +
                  $"Si recibes este mensaje, el servicio de email está funcionando correctamente.\n\n" +
                  $"Fecha: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC\n" +
                  $"Servidor: {Environment.MachineName}"
                : request.Mensaje;

            _logger.LogInformation("Test envio correo a {Correo}", request.Correo);

            var (ok, detalle) = await _emailService.EnviarCorreoTextoAsync(request.Correo, asunto, cuerpo);

            return Ok(new
            {
                codigoS = ok ? 200 : 500,
                mensaje = detalle,
                correo = request.Correo,
                metodo = "texto-plano",
                fecha = DateTime.UtcNow
            });
        }

        [HttpPost("enviar-codigo")]
        public async Task<ActionResult> EnviarCodigo([FromBody] EnviarCodigoTestRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo))
                return Ok(new { codigoS = 400, mensaje = "El campo 'correo' es obligatorio." });

            var codigo = string.IsNullOrWhiteSpace(request.Codigo)
                ? Random.Shared.Next(100000, 999999).ToString()
                : request.Codigo;

            _logger.LogInformation("Test envio codigo OTP a {Correo} codigo={Codigo}", request.Correo, codigo);

            var ok = await _emailService.EnviarCodigoVerificacionAsync(request.Correo, codigo, 5);

            return Ok(new
            {
                codigoS = ok ? 200 : 500,
                mensaje = ok
                    ? $"Código OTP {codigo} enviado a {request.Correo}"
                    : "No se pudo enviar el código OTP. Revisá los logs del backend.",
                correo = request.Correo,
                codigo,
                metodo = "html-otp",
                fecha = DateTime.UtcNow
            });
        }

        [HttpGet("ping")]
        public ActionResult Ping()
        {
            return Ok(new
            {
                codigoS = 200,
                mensaje = "pong",
                fecha = DateTime.UtcNow
            });
        }
    }
}
