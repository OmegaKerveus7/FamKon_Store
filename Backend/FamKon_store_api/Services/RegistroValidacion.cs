using PhoneNumbers;
using System.Text.RegularExpressions;

namespace FamKon_store_api.Services;

public static class RegistroValidacion
{
    public const string ReglaPassword = "Usa entre 8 y 128 caracteres, con al menos una letra mayúscula.";
    public static bool PasswordValido(string? valor) => valor is not null &&
        valor.Length >= 8 && valor.Length <= 128 && Regex.IsMatch(valor, @"\p{Lu}") &&
        !Regex.IsMatch(valor, @"[\r\n]");

    public static bool CorreoValido(string? valor) => valor is not null && valor.Trim().Length <= 254 &&
        Regex.IsMatch(valor.Trim(), @"\A[^\s@]+@[^\s@]+\.[^\s@]+\z");

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
