using FamKon_store_api.Data;
using Microsoft.AspNetCore.Mvc;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class EstadoController : ControllerBase
    {
        private readonly AppDbContext _dbContext;

        public EstadoController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpGet("estado")]
        public async Task<IActionResult> ObtenerEstado()
        {
            var respuesta = new EstadoResponse
            {
                Api = true,
                BaseDeDatos = false,
                Codigo = 500,
                Mensaje = "Error interno desconocido.",
                Fecha = DateTime.Now
            };

            try
            {
                var dbOk = await _dbContext.Database.CanConnectAsync();
                respuesta.BaseDeDatos = dbOk;

                if (dbOk)
                {
                    respuesta.Codigo = 200;
                    respuesta.Mensaje = "Todo correcto. API y base de datos responden.";
                    return Ok(respuesta);
                }

                respuesta.Codigo = 401;
                respuesta.Mensaje = "La base de datos no responde.";
                return StatusCode(401, respuesta);
            }
            catch (Exception ex)
            {
                respuesta.Codigo = 402;
                respuesta.Mensaje = "Hubo un fallo de carga: " + ex.Message;
                return StatusCode(402, respuesta);
            }
        }
    }

    public class EstadoResponse
    {
        public bool Api { get; set; }
        public bool BaseDeDatos { get; set; }
        public int Codigo { get; set; }
        public string Mensaje { get; set; } = string.Empty;
        public DateTime Fecha { get; set; }
    }
}