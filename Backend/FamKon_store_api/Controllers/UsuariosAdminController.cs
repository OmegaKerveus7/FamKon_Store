using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon/admin")]
    [Authorize]
    public class UsuariosAdminController : ControllerBase
    {
        private readonly UsuarioAdminService _adminService;
        private readonly ILogger<UsuariosAdminController> _logger;

        public UsuariosAdminController(
            UsuarioAdminService adminService,
            ILogger<UsuariosAdminController> logger)
        {
            _adminService = adminService;
            _logger = logger;
        }

        // ─── Lista enriquecida (vista VW_GESTOR_USUARIOS) ────────────────────
        [HttpGet("usuarios")]
        public async Task<ActionResult> ListarUsuarios([FromQuery] string soloActivos = "N")
        {
            var lista = await _adminService.ListarUsuariosGestorAsync(soloActivos);
            return Ok(new { codigoS = 200, usuarios = lista });
        }

        // ─── Detalle de un usuario (vista VW_GESTOR_USUARIOS) ─────────────────
        [HttpGet("usuarios/{id:long}")]
        public async Task<ActionResult> ObtenerUsuario(long id)
        {
            var usuario = await _adminService.ObtenerUsuarioGestorAsync(id);
            if (usuario is null)
            {
                return Ok(new { codigoS = 404, mensaje = "Usuario no encontrado." });
            }
            return Ok(new { codigoS = 200, usuario });
        }

        // ─── Alta (PKG_SEGURIDAD.SP_CREAR_USUARIO + SP_ASIGNAR_ROL) ───────────
        [HttpPost("usuarios")]
        public async Task<ActionResult> CrearUsuario([FromBody] CrearUsuarioAdminRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Correo)
                || string.IsNullOrWhiteSpace(request.Nickname)
                || string.IsNullOrWhiteSpace(request.Password))
            {
                return Ok(new { codigoS = 400, mensaje = "Correo, nickname y password son obligatorios." });
            }

            var resultado = await _adminService.CrearUsuarioAsync(request);
            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje,
                data = resultado.Data
            });
        }

        // ─── Actualizar (PKG_SEGURIDAD.SP_ACTUALIZAR_USUARIO) ─────────────────
        [HttpPut("usuarios/{id:long}")]
        public async Task<ActionResult> ActualizarUsuario(long id, [FromBody] ActualizarUsuarioRequest request)
        {
            DateTime? fechaNac = null;
            if (!string.IsNullOrWhiteSpace(request.FechaNacimiento)
                && DateTime.TryParse(request.FechaNacimiento, out var f))
            {
                fechaNac = f;
            }

            if (string.IsNullOrWhiteSpace(request.Correo)
                || string.IsNullOrWhiteSpace(request.Nickname)
                || string.IsNullOrWhiteSpace(request.Telefono)
                || string.IsNullOrWhiteSpace(request.NotificaEmail)
                || string.IsNullOrWhiteSpace(request.NotificaWhatsapp))
            {
                return Ok(new { codigoS = 400, mensaje = "Correo, nickname, telefono y notificaciones son obligatorios." });
            }

            var resultado = await _adminService.ActualizarUsuarioGestorAsync(
                idUsuario: id,
                correo: request.Correo!,
                telefono: request.Telefono!,
                fechaNacimiento: fechaNac,
                nickname: request.Nickname!,
                notificaEmail: request.NotificaEmail!,
                notificaWhatsapp: request.NotificaWhatsapp!);

            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje
            });
        }

        // ─── Activar / Desactivar / Bloquear / Desbloquear ───────────────────
        [HttpPut("usuarios/{id:long}/estado")]
        public async Task<ActionResult> CambiarEstado(long id, [FromBody] CambiarEstadoUsuarioAdminRequest request)
        {
            // request.Opcion: A | D | B | L
            var opcion = (request.Opcion ?? (request.Activo ? "A" : "D")).ToUpperInvariant();

            var resultado = await _adminService.CambiarEstadoSeguridadAsync(id, opcion);
            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje
            });
        }

        // ─── Asignar rol (PKG_SEGURIDAD.SP_ASIGNAR_ROL) ───────────────────────
        [HttpPost("usuarios/{id:long}/roles")]
        public async Task<ActionResult> AsignarRol(long id, [FromBody] AsignarRolRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoRol))
            {
                return Ok(new { codigoS = 400, mensaje = "Codigo de rol obligatorio." });
            }

            var resultado = await _adminService.AsignarRolAsync(id, request.CodigoRol);
            return Ok(new
            {
                codigoS = resultado.CodigoS,
                mensaje = resultado.Mensaje
            });
        }

        // ─── Listado de roles disponibles para el combo del formulario ────────
        [HttpGet("roles")]
        public async Task<ActionResult> ListarRoles()
        {
            var roles = await _adminService.ListarRolesAsync();
            return Ok(new { codigoS = 200, roles });
        }
    }

    public class ActualizarUsuarioRequest
    {
        public string? Correo { get; set; }
        public string? Telefono { get; set; }
        public string? FechaNacimiento { get; set; }
        public string? Nickname { get; set; }
        public string? NotificaEmail { get; set; }
        public string? NotificaWhatsapp { get; set; }
    }

    public class CambiarEstadoUsuarioAdminRequest
    {
        // A=Activar, D=Desactivar, B=Bloquear, L=Desbloquear
        public string? Opcion { get; set; }
        // Mantener compat con versiones anteriores (true=Activar, false=Desactivar)
        public bool Activo { get; set; }
    }

    public class AsignarRolRequest
    {
        public string CodigoRol { get; set; } = string.Empty;
    }
}
