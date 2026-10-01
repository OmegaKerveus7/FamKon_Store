using System.ComponentModel.DataAnnotations;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FamKon_store_api.Controllers;

[ApiController, Route("api/famkon/password"), EnableRateLimiting("password")]
public sealed class PasswordController(PasswordRecoveryService service, BitacoraService audit, ILogger<PasswordController> logger) : ControllerBase
{
    private long Actor => long.Parse(User.FindFirst("sub")!.Value);

    [HttpPost("solicitar"), AllowAnonymous]
    public Task<IActionResult> Solicitar(SolicitarPasswordRequest request) => Ejecutar(async () =>
        Ok(new { solicitud = await service.Solicitar(request.Identificador, request.Canal), mensaje = PasswordRecoveryService.MensajeSolicitud }));

    [HttpPost("perfil/solicitar"), Authorize]
    public Task<IActionResult> SolicitarPerfil(CanalPasswordRequest request) => Ejecutar(async () =>
        Ok(new { solicitud = await service.Solicitar("", request.Canal, Actor), mensaje = PasswordRecoveryService.MensajeSolicitud }));

    [HttpPost("verificar"), AllowAnonymous]
    public Task<IActionResult> Verificar(VerificarPasswordRequest request) => Ejecutar(async () =>
        Ok(new { permiso = await service.Verificar(request.Solicitud, request.Codigo), mensaje = "Código verificado. Crea tu nueva contraseña." }));

    [HttpPost("restablecer"), AllowAnonymous]
    public Task<IActionResult> Restablecer(RestablecerPasswordRequest request) => Ejecutar(async () =>
    {
        var id = await service.Restablecer(request.Solicitud, request.Permiso, request.NuevaContrasena);
        await Registrar(id, "PASSWORD_RECUPERADA");
        return Ok(new { mensaje = "Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña." });
    });

    [HttpPost("cambiar"), Authorize]
    public Task<IActionResult> Cambiar(CambiarPasswordRequest request) => Ejecutar(async () =>
    {
        await service.Cambiar(Actor, request.ContrasenaActual, request.NuevaContrasena);
        await Registrar(Actor, "PASSWORD_CAMBIADA");
        return Ok(new { mensaje = "Contraseña actualizada correctamente." });
    });

    private Task<long?> Registrar(long id, string motivo) => audit.RegistrarAccesoAsync(
        id, "perfil/recuperacion", "CONTRASENA", "S", HttpContext.Connection.RemoteIpAddress?.ToString(),
        userAgent: Request.Headers.UserAgent.ToString(), motivo: motivo);

    private async Task<IActionResult> Ejecutar(Func<Task<IActionResult>> action)
    {
        Response.Headers.CacheControl = "no-store";
        try { return await action(); }
        catch (PasswordFlowException ex) { return StatusCode(ex.Status, new { mensaje = ex.Message }); }
        catch (Exception ex)
        {
            logger.LogError(ex, "No se pudo completar la operación de contraseña");
            return StatusCode(503, new { mensaje = "No se pudo completar la operación. Intenta nuevamente en unos minutos." });
        }
    }
}

public class CanalPasswordRequest
{
    [Required, RegularExpression("^(EMAIL|WHATSAPP)$")]
    public string Canal { get; set; } = "";
}
public sealed class SolicitarPasswordRequest : CanalPasswordRequest
{
    [Required, StringLength(254, MinimumLength = 1)]
    public string Identificador { get; set; } = "";
}
public class SolicitudPasswordRequest
{
    [Required, RegularExpression("^[a-f0-9]{64}$")]
    public string Solicitud { get; set; } = "";
}
public sealed class VerificarPasswordRequest : SolicitudPasswordRequest
{
    [Required, RegularExpression("^[0-9]{6}$")]
    public string Codigo { get; set; } = "";
}
public sealed class RestablecerPasswordRequest : SolicitudPasswordRequest
{
    [Required, RegularExpression("^[a-f0-9]{64}$")]
    public string Permiso { get; set; } = "";
    [Required, StringLength(128, MinimumLength = 8)]
    public string NuevaContrasena { get; set; } = "";
}
public sealed class CambiarPasswordRequest
{
    [Required, StringLength(1024)]
    public string ContrasenaActual { get; set; } = "";
    [Required, StringLength(128, MinimumLength = 8)]
    public string NuevaContrasena { get; set; } = "";
}
