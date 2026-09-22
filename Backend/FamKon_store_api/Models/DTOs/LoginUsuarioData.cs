using System.Text.Json;

namespace FamKon_store_api.Models.DTOs
{
    public class LoginUsuarioData
    {
        public long IdUsuario { get; set; }
        public string Nickname { get; set; } = string.Empty;
        public string Correo { get; set; } = string.Empty;
        public string Telefono { get; set; } = string.Empty;
        public string FechaNacimiento { get; set; } = string.Empty;
        public string Activo { get; set; } = "S";
        public string Bloqueado { get; set; } = "N";
        public string Roles { get; set; } = string.Empty;

        public static LoginUsuarioData? FromJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                return null;

            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                return new LoginUsuarioData
                {
                    IdUsuario = root.GetProperty("id_usuario").GetInt64(),
                    Nickname = root.GetProperty("nickname").GetString() ?? "",
                    Correo = root.GetProperty("correo").GetString() ?? "",
                    Telefono = root.GetProperty("telefono").GetString() ?? "",
                    FechaNacimiento = root.GetProperty("fecha_nacimiento").GetString() ?? "",
                    Activo = root.GetProperty("activo").GetString() ?? "S",
                    Bloqueado = root.GetProperty("bloqueado").GetString() ?? "N",
                    Roles = root.GetProperty("roles").GetString() ?? ""
                };
            }
            catch
            {
                return null;
            }
        }

        public Usuario ToUsuario()
        {
            return new Usuario
            {
                IdUsuario = IdUsuario,
                Nickname = Nickname,
                Correo = Correo,
                Telefono = Telefono,
                FechaNacimiento = string.IsNullOrEmpty(FechaNacimiento)
                    ? null
                    : DateTime.TryParse(FechaNacimiento, out var f) ? f : null,
                Activo = Activo,
                Bloqueado = Bloqueado,
                Roles = Roles
            };
        }
    }
}
