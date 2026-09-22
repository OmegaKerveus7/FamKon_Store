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
        private readonly PermisoService _permisoService;
        private readonly BitacoraService _bitacoraService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            LoginService loginService,
            JwtService jwtService,
            PermisoService permisoService,
            BitacoraService bitacoraService,
            ILogger<AuthController> logger)
        {
            _loginService = loginService;
            _jwtService = jwtService;
            _permisoService = permisoService;
            _bitacoraService = bitacoraService;
            _logger = logger;
        }

        private string? GetClientIp()
        {
            var ip = HttpContext?.Connection?.RemoteIpAddress?.ToString();
            if (string.IsNullOrEmpty(ip) || ip == "::1") ip = "127.0.0.1";
            return ip;
        }

        private string? GetUserAgent()
        {
            return Request?.Headers?["User-Agent"].ToString();
        }

        private async Task RegistrarBitacoraAsync(
            long? idUsuario,
            string identificador,
            string metodo,
            string resultado,
            string motivo)
        {
            try
            {
                await _bitacoraService.RegistrarAccesoAsync(
                    idUsuario: idUsuario,
                    identificador: identificador,
                    metodoAcceso: metodo,
                    resultado: resultado,
                    direccionIp: GetClientIp(),
                    ubicacion: null,
                    userAgent: GetUserAgent(),
                    motivo: motivo);
            }
            catch
            {
            }
        }

        [HttpPost("login_basic")]
        public async Task<ActionResult<LoginResponse>> LoginBasico([FromBody] LoginRequest request)
        {
            var tieneCorreo = !string.IsNullOrWhiteSpace(request.Correo);
            var tieneNickname = !string.IsNullOrWhiteSpace(request.Nickname);

            if (tieneCorreo && tieneNickname)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: $"{request.Correo}|{request.Nickname}",
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Solicitud invalida: correo y nickname juntos.");
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar solo correo o nickname, no ambos."
                });
            }

            if (!tieneCorreo && !tieneNickname)
            {
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'correo' o 'nickname' es obligatorio."
                });
            }

            if (string.IsNullOrWhiteSpace(request.Contrasena))
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: request.Correo ?? request.Nickname ?? "",
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Contrasena vacia.");
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'contrasena' es obligatorio."
                });
            }

            var identificador = request.Correo ?? request.Nickname ?? "";

            // 1) Obtener el registro del usuario (incluye PASSWORD_HASH) via PKG_SEGURIDAD.
            var authUser = await _loginService.ObtenerAutenticacionAsync(identificador);

            if (authUser is null)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Usuario no encontrado.");
                return Ok(new LoginResponse
                {
                    CodigoS = 401,
                    Mensaje = "Credenciales invalidas."
                });
            }

            if (authUser.Bloqueado == "S")
            {
                await RegistrarBitacoraAsync(
                    idUsuario: authUser.IdUsuario,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Usuario bloqueado.");
                return Ok(new LoginResponse
                {
                    CodigoS = 403,
                    Mensaje = "Usuario bloqueado. Contacte al administrador."
                });
            }

            if (authUser.Activo != "S")
            {
                await RegistrarBitacoraAsync(
                    idUsuario: authUser.IdUsuario,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Usuario inactivo.");
                return Ok(new LoginResponse
                {
                    CodigoS = 403,
                    Mensaje = "Usuario inactivo."
                });
            }

            // 2) Validar password localmente con SHA-256 (Oracle STANDARD_HASH('SHA256') lowercase).
            var passwordValido = LoginService.ValidarPassword(request.Contrasena, authUser.PasswordHash);

            if (!passwordValido)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: authUser.IdUsuario,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Contrasena incorrecta.");
                return Ok(new LoginResponse
                {
                    CodigoS = 401,
                    Mensaje = "Credenciales invalidas."
                });
            }

            // 3) Cargar datos completos del usuario (incluye roles) desde PKG_LOGIN.
            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Correo ?? request.Nickname,
                nickname: request.Nickname,
                password: request.Contrasena,
                tokenQr: null,
                idArchivoFoto: null,
                opcion: "C");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
            {
                await RegistrarBitacoraAsync(
                    idUsuario: authUser.IdUsuario,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "No se pudo cargar el perfil completo del usuario.");
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS == 0 ? 500 : resultado.CodigoS,
                    Mensaje = resultado.Mensaje ?? ""
                });
            }

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: authUser.IdUsuario,
                    identificador: identificador,
                    metodo: "CONTRASENA",
                    resultado: "N",
                    motivo: "Error parseando perfil completo del usuario.");
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });
            }

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            // 4) Auditoria exitosa en BITACORA_ACCESO.
            await RegistrarBitacoraAsync(
                idUsuario: authUser.IdUsuario,
                identificador: identificador,
                metodo: "CONTRASENA",
                resultado: "S",
                motivo: "Login exitoso.");

            return Ok(new LoginResponse
            {
                CodigoS = 200,
                Mensaje = "Login exitoso.",
                Token = token,
                Usuario = usuario
            });
        }

        [HttpPost("login/carnet")]
        public async Task<ActionResult<LoginResponse>> LoginCarnet([FromBody] CarnetLoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoQr) && string.IsNullOrWhiteSpace(request.Identificacion))
            {
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar el codigo QR o la identificacion."
                });
            }

            var identificador = !string.IsNullOrWhiteSpace(request.CodigoQr)
                ? request.CodigoQr!
                : request.Identificacion!;

            var opcion = !string.IsNullOrWhiteSpace(request.CodigoQr) ? "Q" : "N";

            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Identificacion,
                nickname: null,
                password: null,
                tokenQr: request.CodigoQr,
                idArchivoFoto: null,
                opcion: opcion);

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: identificador,
                    metodo: "QR",
                    resultado: "N",
                    motivo: resultado.Mensaje ?? "Login QR fallido.");
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS == 0 ? 500 : resultado.CodigoS,
                    Mensaje = resultado.Mensaje ?? ""
                });
            }

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: identificador,
                    metodo: "QR",
                    resultado: "N",
                    motivo: "Error parseando datos del usuario.");
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });
            }

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            await RegistrarBitacoraAsync(
                idUsuario: usuarioData.IdUsuario,
                identificador: identificador,
                metodo: "QR",
                resultado: "S",
                motivo: "Login QR exitoso.");

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
            {
                return Ok(new LoginResponse
                {
                    CodigoS = 400,
                    Mensaje = "Debe enviar la imagen a comparar."
                });
            }

            var identificador = request.Identificacion ?? request.ImagenCompararBase64[..Math.Min(40, request.ImagenCompararBase64.Length)];

            var resultado = await _loginService.LoginAsync(
                usuarioOCorreo: request.Identificacion,
                nickname: null,
                password: null,
                tokenQr: null,
                idArchivoFoto: null,
                opcion: "F");

            if (resultado.CodigoS != 200 || string.IsNullOrEmpty(resultado.Data))
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: identificador,
                    metodo: "FACIAL",
                    resultado: "N",
                    motivo: resultado.Mensaje ?? "Login facial fallido.");
                return Ok(new LoginResponse
                {
                    CodigoS = resultado.CodigoS == 0 ? 500 : resultado.CodigoS,
                    Mensaje = resultado.Mensaje ?? ""
                });
            }

            var usuarioData = LoginUsuarioData.FromJson(resultado.Data);
            if (usuarioData is null)
            {
                await RegistrarBitacoraAsync(
                    idUsuario: null,
                    identificador: identificador,
                    metodo: "FACIAL",
                    resultado: "N",
                    motivo: "Error parseando datos del usuario.");
                return Ok(new LoginResponse
                {
                    CodigoS = 500,
                    Mensaje = "Error al procesar los datos del usuario."
                });
            }

            var usuario = usuarioData.ToUsuario();
            var token = _jwtService.GenerateToken(
                usuarioData.IdUsuario,
                usuarioData.Nickname,
                usuarioData.Correo,
                usuarioData.Roles);

            await RegistrarBitacoraAsync(
                idUsuario: usuarioData.IdUsuario,
                identificador: identificador,
                metodo: "FACIAL",
                resultado: "S",
                motivo: "Login facial exitoso.");

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

        [Authorize]
        [HttpGet("permisos")]
        public async Task<ActionResult> ObtenerPermisos()
        {
            var userId = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId) || !long.TryParse(userId, out var idUsuario))
                return Ok(new { codigoS = 401, mensaje = "Token invalido." });

            var permisos = await _permisoService.ListarPermisosAsync(idUsuario);
            return Ok(new
            {
                codigoS = 200,
                permisos
            });
        }

        [HttpPost("refresh-token")]
        public ActionResult RefreshToken([FromBody] RefreshTokenRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token))
                return Ok(new RefreshTokenResponse
                {
                    CodigoS = 400,
                    Mensaje = "El campo 'token' es obligatorio."
                });

            var principal = _jwtService.ValidateToken(request.Token);
            if (principal is null)
                return Ok(new RefreshTokenResponse
                {
                    CodigoS = 401,
                    Mensaje = "Token invalido o expirado."
                });

            var userId = principal.FindFirst("sub")?.Value;
            var nickname = principal.FindFirst("nickname")?.Value;
            var correo = principal.FindFirst("email")?.Value;
            var roles = principal.FindFirst("roles")?.Value;

            if (string.IsNullOrEmpty(userId) || !long.TryParse(userId, out var idUsuario))
                return Ok(new RefreshTokenResponse
                {
                    CodigoS = 401,
                    Mensaje = "Token invalido."
                });

            var newToken = _jwtService.GenerateToken(
                idUsuario,
                nickname ?? "",
                correo ?? "",
                roles ?? "");

            return Ok(new RefreshTokenResponse
            {
                CodigoS = 200,
                Mensaje = "Token renovado exitosamente.",
                Token = newToken
            });
        }

        [HttpPost("test-token")]
        public ActionResult GenerarTokenPrueba([FromBody] TestTokenRequest request)
        {
            var token = _jwtService.GenerateToken(
                request.IdUsuario,
                request.Nickname,
                request.Correo,
                request.Roles);

            return Ok(new
            {
                codigoS = 200,
                mensaje = "Token generado. Usalo en Authorization: Bearer <token>",
                token
            });
        }

    }

    public class TestTokenRequest
    {
        public long IdUsuario { get; set; } = 1;
        public string Nickname { get; set; } = "test_user";
        public string Correo { get; set; } = "test@famkon.com";
        public string Roles { get; set; } = "COMPRADOR";
    }
}
