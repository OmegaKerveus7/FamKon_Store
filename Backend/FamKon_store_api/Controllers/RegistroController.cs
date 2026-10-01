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

        [HttpPost("registro/comprobar-correo")]
        public async Task<ActionResult> ComprobarCorreo([FromBody] ComprobarCorreoRequest request)
        {
            if (!RegistroValidacion.CorreoValido(request.Correo))
                return Ok(new { codigoS = 400, mensaje = "Ingresa un correo válido." });
            try
            {
                var existe = await _usuarioService.CorreoExisteAsync(request.Correo);
                return Ok(new { codigoS = 200, existe });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error comprobando disponibilidad del correo");
                return Ok(new { codigoS = 503, mensaje = "No se pudo comprobar el correo. Se revisará al continuar." });
            }
        }

        public class ComprobarCorreoRequest
        {
            public string Correo { get; set; } = string.Empty;
        }

        [HttpPost("registro")]
        public async Task<ActionResult<RegistroResponse>> Registrar([FromBody] RegistroRequest request, [FromServices] CredencialService credencial, [FromServices] RegistroRostroService rostros)
        {
            if (!RegistroValidacion.CorreoValido(request.Correo))
                return Ok(new RegistroResponse { CodigoS = 400, Mensaje = "Ingresa un correo válido." });

            if (string.IsNullOrWhiteSpace(request.Nickname))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'nickname' es obligatorio."
                });

            if (!RegistroValidacion.PasswordValido(request.Contrasena))
                return Ok(new RegistroResponse { CodigoS = 400, Mensaje = RegistroValidacion.ReglaPassword });

            if (string.IsNullOrWhiteSpace(request.Nombres) || string.IsNullOrWhiteSpace(request.Apellidos))
                return Ok(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "Los campos 'nombres' y 'apellidos' son obligatorios."
                });

            byte[] original, editada;
            RostroRegistro rostro;
            try { rostro = rostros.Obtener(request.SolicitudRostro, request.FotoOriginalBase64); original = rostro.Original; editada = CredencialService.Imagen(request.FotoEditadaBase64 ?? Convert.ToBase64String(rostro.Segmentada)); CredencialPdf.ColorTema(request.TemaCredencial); }
            catch (InvalidOperationException ex) { return BadRequest(new { mensaje = ex.Message }); }
            var telefono = RegistroValidacion.NormalizarTelefono(request.Telefono);
            if (!RegistroValidacion.TelefonoValido(telefono))
                return Ok(new RegistroResponse { CodigoS = 400, Mensaje = "Ingresa un teléfono válido con código de país (ej. +502 4567 8901)." });

            try
            {
                if (await _usuarioService.CorreoExisteAsync(request.Correo))
                    return Ok(new RegistroResponse { CodigoS = 409, Mensaje = "Este correo ya está registrado. Inicia sesión o utiliza otro correo." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error comprobando correo de registro");
                return Ok(new RegistroResponse { CodigoS = 503, Mensaje = "No se pudo comprobar el correo. Intenta de nuevo." });
            }

            if (!request.NotificaEmail && !request.NotificaWhatsapp) return BadRequest(new { mensaje = "Selecciona al menos un medio de notificación." });
            var resultado = await _usuarioService.CrearUsuarioAsync(
                idSitio: 1,
                correo: request.Correo.Trim().ToLowerInvariant(),
                telefono: telefono,
                fechaNacimiento: request.FechaNacimiento,
                nickname: request.Nickname.Trim(),
                password: request.Contrasena,
                notificaEmail: request.NotificaEmail ? "S" : "N",
                notificaWhatsapp: request.NotificaWhatsapp ? "S" : "N");

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
                var aviso = "Cuenta creada. Tu credencial se enviará por los medios seleccionados.";
                try { await credencial.Emitir(idUsuario, editada, original, rostro.Segmentada, request.TemaCredencial); rostros.Eliminar(request.SolicitudRostro); }
                catch { _logger.LogWarning("Credencial pendiente para usuario {Id}", idUsuario); aviso = "Cuenta creada. No se pudo generar la credencial: inicia sesión y créala en Mi perfil."; }

                return Ok(new RegistroResponse
                {
                    CodigoS = 200,
                    Mensaje = aviso,
                    Data = new RegistroData
                    {
                        IdUsuario = idUsuario,
                        Nickname = request.Nickname.Trim(),
                        CodigoQr = ""
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
