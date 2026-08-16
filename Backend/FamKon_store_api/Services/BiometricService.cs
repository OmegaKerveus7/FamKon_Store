using FamKon_store_api.Models;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace FamKon_store_api.Services
{
    public class BiometricService
    {
        private readonly HttpClient _httpClient;
        private readonly string _segmentarUrl;
        private readonly string _verificarUrl;

        public BiometricService(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _segmentarUrl = configuration["Biometric:SegmentarUrl"] ?? string.Empty;
            _verificarUrl = configuration["Biometric:VerificarUrl"] ?? string.Empty;
        }

        public async Task<ResponseSegmentar?> SegmentarRostroAsync(string rostroBase64)
        {
            var request = new RequestBiometrico { RostroA = rostroBase64 };
            var json = JsonSerializer.Serialize(request);
            return await EnviarAsync<ResponseSegmentar>(_segmentarUrl, json);
        }

        public async Task<ResponseVerificar?> VerificarRostroAsync(string rostroASegmentado, string rostroBSegmentado)
        {
            var request = new RequestBiometrico { RostroA = rostroASegmentado, RostroB = rostroBSegmentado };
            var json = JsonSerializer.Serialize(request);
            return await EnviarAsync<ResponseVerificar>(_verificarUrl, json);
        }

        public async Task<bool> VerificarConexionAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                using var content = new StringContent("{}", Encoding.UTF8, "application/json");
                using var response = await _httpClient.PostAsync(_verificarUrl, content, cts.Token);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private async Task<T?> EnviarAsync<T>(string url, string json)
        {
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            using var response = await _httpClient.PostAsync(url, content);
            response.EnsureSuccessStatusCode();

            var resultJson = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<T>(resultJson);
        }
    }
}