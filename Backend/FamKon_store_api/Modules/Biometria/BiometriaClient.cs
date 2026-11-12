using System.Net.Http.Json;
using System.Text.Json;
using FamKon_store_api.Models;

namespace FamKon_store_api.Modules.Biometria;

public interface IBiometriaClient
{
    Task<byte[]> SegmentarAsync(byte[] imagen, CancellationToken ct);
    Task VerificarAsync(byte[] referencia, byte[] captura, CancellationToken ct);
}

public sealed class BiometriaClient(HttpClient http, IConfiguration config) : IBiometriaClient
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

    public async Task<byte[]> SegmentarAsync(byte[] imagen, CancellationToken ct)
    {
        var r = await EnviarAsync<ResponseSegmentar>("Segmentar", new RequestBiometrico { RostroA = Convert.ToBase64String(imagen) }, ct);
        if (!r.Resultado)
        {
            if (r.Error?.Contains("NotActivatedException", StringComparison.OrdinalIgnoreCase) == true)
                throw new BiometriaException("BIO_NO_ACTIVADO", "El servicio facial tiene desactivado el componente de segmentación. El administrador del servicio debe activarlo para continuar.", 503);
            throw new BiometriaException("BIO_SEGMENTACION_ERROR", $"No se pudo procesar la fotografía: {r.Error}. Intenta de nuevo.", 502);
        }
        if (!r.Segmentado)
            throw new BiometriaException("BIO_ROSTRO_NO_DETECTADO", "No se detectó un rostro válido en la fotografía. Mira a la cámara con buena iluminación y asegúrate de que tu rostro esté visible.", 422);
        if (string.IsNullOrWhiteSpace(r.Rostro))
            throw new BiometriaException("BIO_RESPUESTA_INVALIDA", "El servicio facial no devolvió la imagen segmentada.", 502);
        try { return ImagenBiometrica.Leer(r.Rostro); }
        catch (BiometriaException) { throw new BiometriaException("BIO_RESPUESTA_INVALIDA", "El servicio facial devolvió una imagen inválida.", 502); }
    }

    public async Task VerificarAsync(byte[] referencia, byte[] captura, CancellationToken ct)
    {
        var r = await EnviarAsync<ResponseVerificar>("Verificar", new RequestBiometrico {
            RostroA = Convert.ToBase64String(referencia), RostroB = Convert.ToBase64String(captura)
        }, ct);
        if (!r.Resultado)
            throw new BiometriaException("BIO_VERIFICACION_ERROR", $"El servicio de reconocimiento facial no pudo completar la verificación: {r.Error}. Intenta de nuevo.", 502);
        if (!r.Coincide)
            throw new BiometriaException("BIO_NO_COINCIDE", "El rostro no coincide con tu fotografía registrada. Asegúrate de estar bajo buena iluminación.", 401);
    }

    private async Task<T> EnviarAsync<T>(string operacion, RequestBiometrico payload, CancellationToken ct)
    {
        var baseUrl = config["Biometria:BaseUrl"];
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https")
            throw new BiometriaException("BIO_CONFIGURACION", "El servicio de reconocimiento facial no está configurado.", 503);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, baseUrl!.TrimEnd('/') + "/api/Rostro/" + operacion);
            request.Content = JsonContent.Create(payload, options: Json);
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var contenido = await response.Content.ReadAsStringAsync(ct);
                throw new BiometriaException("BIO_PROVEEDOR_HTTP", $"El servicio facial respondió con error {response.StatusCode}: {contenido}.", 502);
            }
            return await response.Content.ReadFromJsonAsync<T>(Json, ct)
                ?? throw new BiometriaException("BIO_RESPUESTA_INVALIDA", "El servicio facial devolvió una respuesta vacía.", 502);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new BiometriaException("BIO_TIMEOUT", "El servicio facial tardó demasiado. Intenta de nuevo.", 504); }
        catch (BiometriaException) { throw; }
        catch (HttpRequestException)
        { throw new BiometriaException("BIO_CONEXION", "No se pudo conectar con el servicio de reconocimiento facial. Verifica tu conexión a internet.", 502); }
        catch (JsonException)
        { throw new BiometriaException("BIO_RESPUESTA_INVALIDA", "El servicio facial devolvió una respuesta con formato inválido.", 502); }
    }
}
