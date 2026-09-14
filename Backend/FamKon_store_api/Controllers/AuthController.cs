using FamKon_store_api.Models;
using FamKon_store_api.Models.DTOs;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class AuthController : ControllerBase
    {
        private readonly LoginService _loginService;
        private readonly JwtService _jwtService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            LoginService loginService,
            JwtService jwtService,
            ILogger<AuthController> logger)
        {
            _loginService = loginService;
            _jwtService = jwtService;
            _logger = logger;
        }

        [HttpPost("login_basic")]
        public async Task<ActionResult<LoginResponse>> LoginBasico([FromBody] LoginRequest request)
        {
            var tieneCorreo = !string.IsNullOrWhiteSpace(request.Correo);
            var tieneNickname = !string.IsNullOrWhiteSpace(request.Nickname);

            if (tieneCorreo && tieneNickname)
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar solo correo o nickname, no ambos."
                });

            if (!tieneCorreo && !tieneNickname)
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'correo' o 'nickname' es obligatorio."
                });

            if (string.IsNullOrWhiteSpace(request.Contrasena))
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'contrasena' es obligatorio."
                });

            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Correo ?? request.Nickname,
                nickname: request.Nickname,
                password: request.Contrasena,
                tokenQr: null,
                idArchivoFoto: null,
                opcion: "C");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje
                });

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = resultado.Mensaje,
                Token = token,
                Usuario = usuario
            });
        }

        [HttpPost("login/carnet")]
        public async Task<ActionResult<LoginResponse>> LoginCarnet([FromBody] CarnetLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoQr) && string.IsNullOrWhiteSpace(request.Identificacion))
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar el código QR o la identificación."
                });

            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Identificacion,
                nickname: null,
                password: null,
                tokenQr: request.CodigoQr,
                idArchivoFoto: null,
                opcion: request.CodigoQr != null ? "Q" : "N");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje
                });

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = resultado.Mensaje,
                Token = token,
                Usuario = usuario
            });
        }

        [HttpPost("login/facial")]
        public async Task<ActionResult<LoginResponse>> LoginFacial([FromBody] FacialLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ImagenCompararBase64))
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar la imagen a comparar."
                });

            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Identificacion,
                nickname: null,
                password: null,
                tokenQr: null,
                idArchivoFoto: null,
                opcion: "F");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS,
                    Mensaje = resultado.Mensaje
                });

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = resultado.Mensaje,
                Token = token,
                Usuario = usuario
            });
        }

        [Authorize]
        [HttpGet("me")]
        public ActionResult GetCurrentUser()
        {
            var userId = User.FindFirst("sub")?.Value;
            var nickname = User.FindFirst("nickname")?.Value;
            var correo = User.FindFirst("email")?.Value;
            var roles = User.FindFirst("roles")?.Value;

            return Ok(new
            {
                id_usuario = userId,
                nickname,
                correo,
                roles
            });
        }

    }
}
