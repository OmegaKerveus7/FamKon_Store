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
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo) && string.IsNullOrWhiteSpace(request.Nickname))
                return BadRequest(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar el correo o el nickname."
                });

            if (string.IsNullOrWhiteSpace(request.Contrasena))
                return BadRequest(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar la contraseña."
                });

            var resultado = await _usuarioRepository.LoginPorCredencialesAsync(
                request.Correo, request.Nickname, request.Contrasena);

            if (resultado.CodigoS != 200 || resultado.Usuario is null)
                return Unauthorized(new LoginResponse
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje
                });

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = resultado.Mensaje,
                Data = resultado.Usuario
            });
        }

        [HttpPost("login/facial")]
        public async Task<ActionResult<LoginResponse>> LoginFacial([FromBody] FacialLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ImagenCompararBase64))
                return BadRequest(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar la imagen a comparar."
                });

            Usuario? usuario_bd = null;

            if (!string.IsNullOrWhiteSpace(request.Identificacion))
            {
                usuario_bd = await _usuarioRepository.ObtenerPorIdentificacionAsync(request.Identificacion);
            }

            var imagenOriginal = usuario_bd?.FotoOriginal ?? request.ImagenOriginalBase64;

            if (string.IsNullOrWhiteSpace(imagenOriginal))
                return BadRequest(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar la imagen original o la identificación del usuario."
                });

            try
            {
                var segmentarOriginal = await _biometricService.SegmentarRostroAsync(imagenOriginal);
                var segmentarComparar = await _biometricService.SegmentarRostroAsync(request.ImagenCompararBase64);

                if (segmentarOriginal is null || segmentarComparar is null)
                    return StatusCode(StatusCodes.Status502BadGateway, new LoginResponse
                    {
                        CodigoS = 502,
                        Mensaje = "La API de segmentación no respondió correctamente."
                    });

                if (!segmentarOriginal.Segmentado || !segmentarComparar.Segmentado)
                    return BadRequest(new LoginResponse
                    {
                        CodigoS = 400,
                        Mensaje = "No se pudo segmentar el rostro de una o ambas imágenes."
                    });

                var verificar = await _biometricService.VerificarRostroAsync(
                    segmentarOriginal.Rostro,
                    segmentarComparar.Rostro);

                if (verificar is null)
                    return StatusCode(StatusCodes.Status502BadGateway, new LoginResponse
                    {
                        CodigoS = 502,
                        Mensaje = "La API de verificación no respondió correctamente."
                    });

                if (!verificar.Coincide)
                    return Unauthorized(new LoginResponse
                    {
                        CodigoS = 401,
                        Mensaje = "Los rostros no coinciden."
                    });

                if (usuario_bd is null)
                    return Unauthorized(new LoginResponse
                    {
                        CodigoS = 401,
                        Mensaje = "No se encontró el usuario del rostro."
                    });

                return Ok(new LoginResponse
                {
                    CodigoS = 200,
                    Mensaje = "Login facial exitoso.",
                    Data = usuario_bd
                });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al consumir el servicio biométrico: " + ex.Message
                });
            }
        }

        [HttpPost("login/carnet")]
        public async Task<ActionResult<LoginResponse>> LoginCarnet([FromBody] CarnetLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoQr) && string.IsNullOrWhiteSpace(request.Identificacion))
                return BadRequest(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar el código QR o la identificación."
                });

            LoginResult? resultado = null;

            if (!string.IsNullOrWhiteSpace(request.CodigoQr))
            {
                resultado = await _usuarioRepository.LoginPorQrAsync(request.CodigoQr);
            }

            if (resultado is null || resultado.CodigoS != 200)
            {
                if (!string.IsNullOrWhiteSpace(request.Identificacion))
                {
                    var usuario = await _usuarioRepository.ObtenerPorIdentificacionAsync(request.Identificacion);
                    if (usuario is not null)
                    {
                        resultado = new LoginResult
                        {
                            CodigoS = 200,
                            Mensaje = "Login por identificación exitoso.",
                            Usuario = usuario
                        };
                    }
                }
            }

            if (resultado is null || resultado.CodigoS != 200 || resultado.Usuario is null)
                return Unauthorized(new LoginResponse
                {
                    CodigoS = 401,
                    Mensaje = "No se pudo autenticar con el carnet o código QR."
                });

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = resultado.Mensaje,
                Data = resultado.Usuario
            });
        }

        [HttpPost("registro")]
        public async Task<ActionResult<RegistroResponse>> Registrar(
    [FromBody] RegistroRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Nombres))
            {
                return BadRequest(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "Los nombres son obligatorios."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Apellidos))
            {
                return BadRequest(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "Los apellidos son obligatorios."
                });
            }

            if (string.IsNullOrWhiteSpace(request.FotoOriginalBase64))
            {
                return BadRequest(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "La fotografía original es obligatoria."
                });
            }

            if (request.FechaNacimiento == default ||
                request.FechaNacimiento.Date > DateTime.Today)
            {
                return BadRequest(new RegistroResponse
                {
                    CodigoS = 400,
                    Mensaje = "La fecha de nacimiento no es válida."
                });
            }

            var resultado =
                await _usuarioRepository.RegistrarCompradorAsync(request);

            var response = new RegistroResponse
            {
                CodigoS = resultado.CodigoS,
                Mensaje = resultado.Mensaje,
                Data = resultado.Data
            };

            return resultado.CodigoS switch
            {
                200 => Ok(response),
                400 => BadRequest(response),
                404 => NotFound(response),
                409 => Conflict(response),
                _ => StatusCode(
                    StatusCodes.Status500InternalServerError,
                    response)
            };
        }


    }
}
