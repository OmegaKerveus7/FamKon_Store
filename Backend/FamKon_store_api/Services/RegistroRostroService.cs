using System.Security.Cryptography;
using FamKon_store_api.Modules.Biometria;
using Microsoft.Extensions.Caching.Memory;
namespace FamKon_store_api.Services;
public sealed record RostroRegistro(byte[] Original,byte[] Segmentada);
// Vincula la captura original con la imagen segmentada recibida del proveedor.
public sealed class RegistroRostroService : IDisposable {
 readonly MemoryCache cache=new(new MemoryCacheOptions{SizeLimit=64*1024*1024});
 public string Guardar(byte[] original,byte[] segmentada){var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();cache.Set(token,new RostroRegistro(original,segmentada),new MemoryCacheEntryOptions{AbsoluteExpirationRelativeToNow=TimeSpan.FromMinutes(15),Size=original.Length+segmentada.Length});return token;}
 public RostroRegistro Obtener(string token,string original){if(!cache.TryGetValue(token,out RostroRegistro? foto)||foto is null)throw new InvalidOperationException("La preparación del rostro venció. Captura y segmenta la foto nuevamente.");var bytes=CredencialService.Imagen(original);if(!CryptographicOperations.FixedTimeEquals(SHA256.HashData(bytes),SHA256.HashData(foto.Original)))throw new InvalidOperationException("La fotografía cambió. Segmenta el rostro nuevamente.");return foto;}
 public void Eliminar(string token)=>cache.Remove(token);
 public void Dispose()=>cache.Dispose();
}
