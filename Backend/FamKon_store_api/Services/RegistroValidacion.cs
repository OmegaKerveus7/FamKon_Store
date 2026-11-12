using PhoneNumbers;
using System.Text.RegularExpressions;

namespace FamKon_store_api.Services;

public static class RegistroValidacion
{
    public const string ReglaPassword = "Usa entre 8 y 128 caracteres, con al menos una letra mayúscula.";
    public static bool PasswordValido(string? valor) => valor is not null &&
        valor.Length >= 8 && valor.Length <= 128 && Regex.IsMatch(valor, @"\p{Lu}") &&
        !Regex.IsMatch(valor, @"[\r\n]");

    /// <summary>
    /// Correo legible: una sola arroba y dominio con puntos, admitiendo niveles
    /// multiples (gmail.com.gt, claro.org.gt). Rechaza "avvav@@q.com" y otras
    /// variantes sin dominio real.
    /// </summary>
    private static readonly Regex CorreoRegex = new(
        @"\A[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}\z",
        RegexOptions.Compiled);

    public static bool CorreoValido(string? valor) => valor is not null && valor.Trim().Length <= 254 &&
        CorreoRegex.IsMatch(valor.Trim());

    /// <summary>Nombre y apellido: solo letras (con espacios, apostrofos y guiones).</summary>
    public static bool NombreValido(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return false;
        var limpio = Regex.Replace(valor.Trim(), @"\s+", " ");
        if (limpio.Length > 60) return false;
        if (!Regex.IsMatch(limpio, @"^\p{L}[\p{L}\p{M}'’\- ]*$")) return false;
        return Regex.IsMatch(limpio, @"[\p{L}\p{M}]$");
    }

    /// <summary>Fecha de nacimiento: solo fechas pasadas y con edad razonable.</summary>
    public static bool FechaNacimientoValida(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return false;
        if (!DateTime.TryParse(valor, out var fecha)) return false;
        var hoy = DateTime.Today;
        if (fecha.Date >= hoy) return false;
        var edad = hoy.Year - fecha.Year;
        if (hoy < fecha.AddYears(edad)) edad--;
        return edad is >= 10 and <= 120;
    }

    public static string NormalizarTelefono(string? valor) => Regex.Replace((valor ?? "").Trim(), @"[ ()-]", "");

    public static bool TelefonoValido(string? valor)
    {
        var numero = NormalizarTelefono(valor);
        if (!Regex.IsMatch(numero, @"\A\+[1-9][0-9]{6,14}\z")) return false;
        try
        {
            var util = PhoneNumberUtil.GetInstance();
            return util.IsValidNumber(util.Parse(numero, null));
        }
        catch (NumberParseException)
        {
            return false;
        }
    }
}
