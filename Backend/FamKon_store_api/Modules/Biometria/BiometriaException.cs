namespace FamKon_store_api.Modules.Biometria;

public sealed class BiometriaException(string codigo, string mensaje, int estado = 400) : Exception(mensaje)
{
    public string Codigo { get; } = codigo;
    public int Estado { get; } = estado;
}

public static class ImagenBiometrica
{
    public static byte[] Leer(string? imagen)
    {
        if (string.IsNullOrWhiteSpace(imagen) || imagen.Length > 7_000_000)
            throw new BiometriaException("BIO_IMAGEN_INVALIDA", "Envía una foto JPG o PNG de hasta 5 MB.");
        var contenido = imagen.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)
            ? imagen[(imagen.IndexOf(',') + 1)..] : imagen;
        byte[] bytes;
        try { bytes = Convert.FromBase64String(contenido); }
        catch (FormatException) { throw new BiometriaException("BIO_IMAGEN_INVALIDA", "La fotografía no es una imagen válida."); }
        if (bytes.Length is < 8 or > 5 * 1024 * 1024 || Mime(bytes) is null)
            throw new BiometriaException("BIO_IMAGEN_INVALIDA", "Envía una foto JPG o PNG de hasta 5 MB.");
        return bytes;
    }

    public static string? Mime(byte[] bytes) =>
        bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff ? "image/jpeg" :
        bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137, 80, 78, 71, 13, 10, 26, 10}) ? "image/png" : null;
}
