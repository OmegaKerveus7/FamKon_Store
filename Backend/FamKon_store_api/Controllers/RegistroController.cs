using FamKon_store_api.Models.DTOs;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class RegistroController : ControllerBase
    {
        private readonly UsuarioService _usuarioService;
        private readonly ILogger<RegistroController> _logger;

        public RegistroController(
            UsuarioService usuarioService,
            ILogger<RegistroController> logger)
        {
            _usuarioService = usuarioService;
            _logger = logger;
        }

        [HttpPost("registro")]
        public async Task<ActionResult<RegistroResponse>> Registrar([FromBody] RegistroRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'correo' es obligatorio."
                });

            if (string.IsNullOrWhiteSpace(request.Nickname))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'nickname' es obligatorio."
                });

            if (string.IsNullOrWhiteSpace(request.Contrasena))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'contrasena' es obligatorio."
                });

            if (string.IsNullOrWhiteSpace(request.Nombres) || string.IsNullOrWhiteSpace(request.Apellidos))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "Los campos 'nombres' y 'apellidos' son obligatorios."
                });

            var telefono = $"{request.Nombres.Trim().Substring(0, 1).ToUpper()}{request.Apellidos.Trim().Substring(0, 1).ToUpper()}{new Random().Next(100000, 999999)}";

            var resultado = await _usuarioService.CrearUsuarioAsync(
                idSitio: 1,
                correo: request.Correo.Trim(),
                telefono: telefono,
                fechaNacimiento: request.FechaNacimiento,
                nickname: request.Nickname.Trim(),
                password: request.Contrasena,
                notificaEmail: "S",
                notificaWhatsapp: "N");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
                return Ok(new RegistroResponse
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje
                });

            try
            {
                using var doc = JsonDocument.Parse(resultado.Data);
                var root = doc.RootElement;

                var idUsuario = root.GetProperty("id_usuario").GetInt32();
                var tokenQr = root.GetProperty("token_qr").GetString() ?? "";

                return Ok(new RegistroResponse
                {
                    CodigoS = 200,
                    Mensaje = resultado.Mensaje,
                    Data = new RegistroData
                    {
                        IdUsuario = idUsuario,
                        Nickname = request.Nickname.Trim(),
                        CodigoQr = tokenQr
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parseando respuesta de registro");
                return Ok(new RegistroResponse
                {
                    CodigoS = 200,
                    Mensaje = resultado.Mensaje
                });
            }
        }
    }
}
