using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.Modules.Biometria;

public sealed class AccesoFacialRequest
{
    public string ImagenCompararBase64 { get; set; } = "";
}
public sealed class EnrolamientoFacialRequest
{
    public string Contrasena { get; set; } = "";
    public string FotoBase64 { get; set; } = "";
}

[ApiController]
[Route("api/famkon/biometria")]
public sealed class BiometriaController(
    BiometriaService service, BiometriaRepository repository, JwtService jwt,
    BitacoraService bitacora, ILogger<BiometriaController> logger) : ControllerBase
{
    [HttpPost("login")]
    [HttpPost("/api/famkon/login/facial")]
    public Task<ActionResult> Login(AccesoFacialRequest request, CancellationToken ct) =>
        EjecutarAsync("LOGIN", "captura-facial", async contexto => {
            var validado = await service.IdentificarAsync(request.ImagenCompararBase64, ct);
            contexto.IdUsuario = validado.IdUsuario;
            return new {
                codigoS = 200, codigo = "BIO_LOGIN_OK", mensaje = "Identidad facial verificada.",
                referencia = contexto.Referencia,
                token = jwt.GenerateToken(validado.IdUsuario, validado.Nickname, validado.Correo, validado.Roles ?? ""),
                usuario = validado
            };
        });

    [Authorize]
    [HttpPost("enrolar")]
    public Task<ActionResult> Enrolar(EnrolamientoFacialRequest request, CancellationToken ct) =>
        EjecutarAsync("ENROLAMIENTO", "cuenta-autenticada", async contexto => {
            if (!long.TryParse(User.FindFirst("sub")?.Value, out var id))
                throw new BiometriaException("BIO_SESION", "Inicia sesión nuevamente.", 401);
            contexto.IdUsuario = id;
            var usuario = await repository.BuscarAsync(null, id, ct);
            BiometriaService.ComprobarCuenta(usuario);
            var foto = await service.EnrolarAsync(usuario!, request.Contrasena, request.FotoBase64, ct);
            return new {
                codigoS = 200, codigo = "BIO_ENROLAMIENTO_OK", mensaje = "Rostro registrado. Ya puedes utilizar el acceso facial.",
                referencia = contexto.Referencia,
                fotoSegmentada = $"data:{ImagenBiometrica.Mime(foto)};base64,{Convert.ToBase64String(foto)}"
            };
        });

    [Authorize]
    [HttpGet("foto")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Foto(CancellationToken ct)
    {
        if (!long.TryParse(User.FindFirst("sub")?.Value, out var id)) return Unauthorized();
        var usuario = await repository.BuscarAsync(null, id, ct);
        if (usuario is null || usuario.Usuario.Activo != "S" || usuario.Usuario.Bloqueado != "N") return Unauthorized();
        // Mostrar solo referencias sin efectos; nunca la imagen decorada del carnet.
        byte[]? foto = null;
        if (usuario.FotoSegmentada is long segmentada)
            foto = await repository.FotoAsync(segmentada, id, ct);
        if ((foto is null || foto.Length == 0) && usuario.FotoOriginal is long original)
            foto = await repository.FotoAsync(original, id, ct);
        if (foto is not { Length: > 0 }) return NotFound();
        var mime = ImagenBiometrica.Mime(foto);
        return mime is null ? NotFound() : File(foto, mime);
    }

    private sealed class Contexto
    {
        public long? IdUsuario { get; set; }
        public string Referencia { get; } = Guid.NewGuid().ToString("N");
    }

    private async Task<ActionResult> EjecutarAsync(string operacion, string? identificador, Func<Contexto, Task<object>> ejecutar)
    {
        var contexto = new Contexto();
        var codigo = "BIO_INTERNO";
        var exito = false;
        using var scope = logger.BeginScope(new Dictionary<string, object> {
            ["Modulo"] = "BIOMETRIA", ["Operacion"] = operacion, ["Referencia"] = contexto.Referencia
        });
        try
        {
            var respuesta = await ejecutar(contexto);
            exito = true;
            codigo = "BIO_" + operacion + "_OK";
            return Ok(respuesta);
        }
        catch (BiometriaException ex)
        {
            codigo = ex.Codigo;
            return Ok(new { codigoS = ex.Estado, codigo, mensaje = ex.Message, referencia = contexto.Referencia });
        }
        catch (OperationCanceledException)
        {
            codigo = "BIO_CANCELADO";
            return StatusCode(499, new { codigoS = 499, codigo, mensaje = "Operación cancelada.", referencia = contexto.Referencia });
        }
        catch (OracleException ex)
        {
            codigo = "BIO_BD";
            logger.LogError("BIOMETRIA {Operacion} {Codigo} referencia={Referencia} oracle={OracleCodigo}",
                operacion, codigo, contexto.Referencia, ex.Number);
            return Ok(new { codigoS = 503, codigo, mensaje = "No se pudo consultar o guardar la información facial. Intenta de nuevo.", referencia = contexto.Referencia });
        }
        catch (Exception ex)
        {
            // No se registra el cuerpo de las peticiones, las fotos ni mensajes del proveedor.
            logger.LogError("BIOMETRIA {Operacion} {Codigo} referencia={Referencia} tipo={Tipo}", operacion, codigo, contexto.Referencia, ex.GetType().Name);
            return Ok(new { codigoS = 500, codigo, mensaje = "No se pudo completar la operación facial.", referencia = contexto.Referencia });
        }
        finally
        {
            logger.LogInformation("BIOMETRIA {Operacion} {Codigo} referencia={Referencia} usuario={Usuario}", operacion, codigo, contexto.Referencia, contexto.IdUsuario);
            var id = await bitacora.RegistrarAccesoAsync(contexto.IdUsuario,
                string.IsNullOrWhiteSpace(identificador) ? "biometria" : identificador.Trim()[..Math.Min(identificador.Trim().Length, 100)],
                "FACIAL", exito ? "S" : "N", HttpContext.Connection.RemoteIpAddress?.ToString(),
                userAgent: Request.Headers.UserAgent.ToString(),
                motivo: $"BIOMETRIA/{operacion}/{codigo}; ref={contexto.Referencia}");
            if (id is null) logger.LogError("BIOMETRIA BIO_AUDITORIA_FALLO referencia={Referencia}", contexto.Referencia);
        }
    }
}
