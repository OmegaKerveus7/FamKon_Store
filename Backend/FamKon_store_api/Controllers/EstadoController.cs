using FamKon_store_api.BD;
using Microsoft.AspNetCore.Mvc;
using Oracle.ManagedDataAccess.Client;

namespace FamKon_store_api.Controllers
{
    [ApiController]
    [Route("api/famkon")]
    public class EstadoController : ControllerBase
    {
        private readonly DBContext _dbContext;

        public EstadoController(DBContext dbContext)
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
                using var connection = _dbContext.CreateConnection();
                await _dbContext.OpenConnectionAsync(connection);
                respuesta.BaseDeDatos = true;

                respuesta.Codigo = 200;
                respuesta.Mensaje = "Todo correcto. API y base de datos responden.";
                return Ok(respuesta);
            }
            catch (Exception ex)
            {
                respuesta.Codigo = 500;
                respuesta.Mensaje = "La base de datos no responde: " + ex.Message;
                return StatusCode(500, respuesta);
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
