using System.ComponentModel.DataAnnotations;

namespace FamKon_store_api.Models.DTOs
{
    public class RegistroRequest
    {
        [Required]
        [MaxLength(120)]
        public string Nombres { get; set; } = string.Empty;

        [Required]
        [MaxLength(120)]
        public string Apellidos { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Correo { get; set; } = string.Empty;

        [Required]
        [MinLength(8)]
        public string Contrasena { get; set; } = string.Empty;

        [Required]
        public DateTime FechaNacimiento { get; set; }

        [Required]
        [MaxLength(120)]
        public string Nickname { get; set; } = string.Empty;

        [Required]
        public string FotoOriginalBase64 { get; set; } = string.Empty;

        public string? FotoEditadaBase64 { get; set; }
    }
}