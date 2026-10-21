using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/famkon/personalizaciones")]
    public class PersonalizacionController : ControllerBase
    {
        private readonly PersonalizacionService _personalizacion;

        public PersonalizacionController(PersonalizacionService personalizacion)
        {
            _personalizacion = personalizacion;
        }

        private long? ObtenerUsuarioId()
        {
            var sub = User.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(sub) || !long.TryParse(sub, out var id)) return null;
            return id;
        }

        [HttpPost]
        public async Task<ActionResult> Crear([FromBody] CrearPersonalizacionRequest request)
        {
            var usuario = ObtenerUsuarioId();
            if (usuario is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });
            if (request.IdProducto <= 0) return BadRequest(new { codigoS = 400, mensaje = "El producto es obligatorio." });

            try
            {
                var id = await _personalizacion.CrearAsync(usuario.Value, request.IdProducto, AContenido(request));
                return Ok(new { codigoS = 200, idPersonalizacion = id });
            }
            catch (Exception ex) when (ex is OracleException or InvalidOperationException)
            {
                return BadRequest(new { codigoS = 400, mensaje = Mensaje(ex) });
            }
        }

        [HttpPut("{id:long}")]
        public async Task<ActionResult> Actualizar(long id, [FromBody] ActualizarPersonalizacionRequest request)
        {
            var usuario = ObtenerUsuarioId();
            if (usuario is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            try
            {
                var actualizada = await _personalizacion.ActualizarAsync(usuario.Value, id, AContenido(request));
                return actualizada is null
                    ? NotFound(new { codigoS = 404, mensaje = "Personalización no encontrada." })
                    : Ok(new { codigoS = 200, personalizacion = actualizada });
            }
            catch (Exception ex) when (ex is OracleException or InvalidOperationException)
            {
                return BadRequest(new { codigoS = 400, mensaje = Mensaje(ex) });
            }
        }

        [HttpGet("{id:long}")]
        public async Task<ActionResult> Obtener(long id)
        {
            var usuario = ObtenerUsuarioId();
            if (usuario is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });

            var personalizacion = await _personalizacion.ObtenerAsync(id);
            if (personalizacion is null || !await _personalizacion.PuedeVerAsync(usuario.Value, id))
                return NotFound(new { codigoS = 404, mensaje = "Personalización no encontrada." });
            return Ok(new { codigoS = 200, personalizacion });
        }

        [HttpPost("imagen"), Consumes("multipart/form-data"), RequestSizeLimit(6 * 1024 * 1024)]
        public async Task<ActionResult> SubirImagen(IFormFile archivo, [FromQuery] string lado = "A")
        {
            var usuario = ObtenerUsuarioId();
            if (usuario is null) return Ok(new { codigoS = 401, mensaje = "No autorizado." });
            if (lado is not ("A" or "B")) return BadRequest(new { codigoS = 400, mensaje = "El lado debe ser A o B." });
            if (archivo is null || archivo.Length == 0) return BadRequest(new { codigoS = 400, mensaje = "Selecciona una imagen." });

            try
            {
                var id = await _personalizacion.SubirImagenAsync(usuario.Value, lado, archivo);
                return id is null
                    ? BadRequest(new { codigoS = 400, mensaje = "No se pudo guardar la imagen." })
                    : Ok(new { codigoS = 200, idArchivo = id.Value });
            }
            catch (Exception ex) when (ex is OracleException or InvalidOperationException)
            {
                return BadRequest(new { codigoS = 400, mensaje = Mensaje(ex) });
            }
        }

        private static PersonalizacionContenido AContenido(CrearPersonalizacionRequest request) => new()
        {
            IdArchivoLadoA = request.IdArchivoLadoA,
            IdArchivoLadoB = request.IdArchivoLadoB,
            MensajeLadoA = request.MensajeLadoA,
            MensajeLadoB = request.MensajeLadoB,
            ConfigLadoA = request.ConfigLadoA,
            ConfigLadoB = request.ConfigLadoB,
        };

        private static PersonalizacionContenido AContenido(ActualizarPersonalizacionRequest request) => new()
        {
            IdArchivoLadoA = request.IdArchivoLadoA,
            IdArchivoLadoB = request.IdArchivoLadoB,
            MensajeLadoA = request.MensajeLadoA,
            MensajeLadoB = request.MensajeLadoB,
            ConfigLadoA = request.ConfigLadoA,
            ConfigLadoB = request.ConfigLadoB,
        };

        private static string Mensaje(Exception ex)
        {
            if (ex is InvalidOperationException) return ex.Message;
            return ex.Message.Split('\n')[0].Split(':', 2).Last().Trim();
        }
    }

    public class CrearPersonalizacionRequest : PersonalizacionContenido
    {
        public long IdProducto { get; set; }
    }

    public class ActualizarPersonalizacionRequest : PersonalizacionContenido
    {
    }
}
