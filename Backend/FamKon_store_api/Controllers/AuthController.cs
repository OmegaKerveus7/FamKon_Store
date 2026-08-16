using FamKon_store_api.Data;
using FamKon_store_api.Models;
using FamKon_store_api.Models.DTOs;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class AuthController : ControllerBase
    {
        private readonly IUsuarioRepository _usuarioRepository;
        private readonly BiometricService _biometricService;

        public AuthController(IUsuarioRepository usuarioRepository, BiometricService biometricService)
        {
            _usuarioRepository = usuarioRepository;
            _biometricService = biometricService;
        }

        [HttpPost("login")]
        public async Task<ActionResult<Usuario>> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo) && string.IsNullOrWhiteSpace(request.NombreUsuario))
                return BadRequest("Debe enviar el correo o el nombre de usuario.");

            var usuario = await _usuarioRepository.ObtenerPorCredenciales(request.Correo, request.NombreUsuario, request.Contrasena);
            if (usuario is null)
                return Unauthorized("Correo/usuario o contraseña incorrectos.");

            return Ok(usuario);
        }

        [HttpPost("login/facial")]
        public async Task<ActionResult<Usuario>> LoginFacial([FromBody] FacialLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ImagenCompararBase64))
                return BadRequest("Debe enviar la imagen a comparar.");

            var usuarioPorIdentificacion = !string.IsNullOrWhiteSpace(request.Identificacion)
                ? await _usuarioRepository.ObtenerPorIdentificacionAsync(request.Identificacion)
                : null;

            var imagenOriginal = usuarioPorIdentificacion?.ImagenOriginalBase64 ?? request.ImagenOriginalBase64;

            if (string.IsNullOrWhiteSpace(imagenOriginal))
                return BadRequest("Debe enviar la imagen original o la identificación del usuario.");

            try
            {
                var segmentarOriginal = await _biometricService.SegmentarRostroAsync(imagenOriginal);
                var segmentarComparar = await _biometricService.SegmentarRostroAsync(request.ImagenCompararBase64);

                if (segmentarOriginal is null || segmentarComparar is null)
                    return StatusCode(StatusCodes.Status502BadGateway, "La API de segmentación no respondió correctamente.");

                var verificar = await _biometricService.VerificarRostroAsync(
                    segmentarOriginal.Rostro,
                    segmentarComparar.Rostro);

                if (verificar is null)
                    return StatusCode(StatusCodes.Status502BadGateway, "La API de verificación no respondió correctamente.");

                if (!verificar.Coincide)
                    return Unauthorized("Los rostros no coinciden.");

                var usuario = usuarioPorIdentificacion ?? await _usuarioRepository.ObtenerPorRostro(imagenOriginal);
                if (usuario is null)
                    return Unauthorized("No se encontró el usuario del rostro.");

                return Ok(usuario);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, "Error al consumir el servicio biométrico: " + ex.Message);
            }
        }

        [HttpPost("login/carnet")]
        public async Task<ActionResult<Usuario>> LoginCarnet([FromBody] CarnetLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CarnetImagenBase64) && string.IsNullOrWhiteSpace(request.CodigoQr) && string.IsNullOrWhiteSpace(request.Identificacion))
                return BadRequest("Debe enviar la imagen del carnet, el código QR o la identificación.");

            var usuario = await _usuarioRepository.ObtenerPorCarnet(request.CodigoQr, request.Identificacion);
            if (usuario is null)
                return Unauthorized("No se pudo reconocer el carnet.");

            return Ok(usuario);
        }
    }
}