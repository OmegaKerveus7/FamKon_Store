using FamKon_store_api.Models;
using FamKon_store_api.Services;

namespace FamKon_store_api.Modules.Biometria;

public sealed class BiometriaService(IBiometriaRepository repository, IBiometriaClient client, LoginService login)
{
    public static void ComprobarCuenta(UsuarioBiometrico? usuario)
    {
        if (usuario is null) throw new BiometriaException("BIO_USUARIO_NO_ENCONTRADO", "No se pudo validar la cuenta indicada.", 401);
        if (usuario.Usuario.Activo != "S" || usuario.Usuario.Bloqueado != "N")
            throw new BiometriaException("BIO_CUENTA_NO_HABILITADA", "La cuenta no está habilitada para acceder.", 403);
    }

    public async Task<byte[]> ReferenciaAsync(UsuarioBiometrico usuario, CancellationToken ct)
    {
        if (usuario.FotoSegmentada is long segmentada)
        {
            var imagen = await repository.FotoAsync(segmentada, usuario.Usuario.IdUsuario, ct);
            if (imagen is { Length: > 0 }) return imagen;
        }
        if (usuario.FotoOriginal is long original)
        {
            var imagen = await repository.FotoAsync(original, usuario.Usuario.IdUsuario, ct);
            if (imagen is { Length: > 0 }) return await client.SegmentarAsync(imagen, ct);
        }
        throw new BiometriaException("BIO_SIN_REFERENCIA", "Primero inicia sesión con tu contraseña y registra tu rostro en Mi Perfil.", 409);
    }

    public async Task<Usuario> IdentificarAsync(string captura, CancellationToken ct)
    {
        var imagen = ImagenBiometrica.Leer(captura);
        using var plazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        plazo.CancelAfter(TimeSpan.FromSeconds(60));
        try
        {
            // La API compara pares; se debe revisar toda la galería para descartar ambigüedad.
            const int maxReferencias = 100;
            var candidatos = await repository.ListarReferenciasAsync(maxReferencias + 1, plazo.Token);
            if (candidatos.Count > maxReferencias)
                throw new BiometriaException("BIO_GALERIA_LIMITE", "La identificación facial no está disponible. Utiliza tu contraseña.", 503);
            if (candidatos.Count == 0)
                throw new BiometriaException("BIO_SIN_REFERENCIA", "Primero inicia sesión con contraseña y registra tu rostro en Mi Perfil.", 409);
            var segmentada = await client.SegmentarAsync(imagen, plazo.Token);
            UsuarioBiometrico? coincidencia = null;
            foreach (var candidato in candidatos)
            {
                plazo.Token.ThrowIfCancellationRequested();
                var referencia = await ReferenciaAsync(candidato, plazo.Token);
                try { await client.VerificarAsync(referencia, segmentada, plazo.Token); }
                catch (BiometriaException ex) when (ex.Codigo == "BIO_NO_COINCIDE") { continue; }
                if (coincidencia is not null)
                    throw new BiometriaException("BIO_COINCIDENCIA_AMBIGUA", "No se pudo identificar una cuenta única. Inicia sesión con tu contraseña.", 409);
                coincidencia = candidato;
            }
            if (coincidencia is null)
                throw new BiometriaException("BIO_NO_COINCIDE", "No encontramos una cuenta que coincida con tu rostro. Intenta de nuevo o utiliza tu contraseña.", 401);
            var actual = await repository.BuscarAsync(null, coincidencia.Usuario.IdUsuario, plazo.Token);
            ComprobarCuenta(actual);
            if (actual!.FotoOriginal != coincidencia.FotoOriginal || actual.FotoSegmentada != coincidencia.FotoSegmentada)
                throw new BiometriaException("BIO_CUENTA_CAMBIO", "La foto de referencia cambió. Intenta de nuevo.", 409);
            return actual.Usuario;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new BiometriaException("BIO_TIMEOUT", "No se pudo completar la identificación a tiempo. Intenta de nuevo o utiliza tu contraseña.", 504);
        }
    }

    public async Task<Usuario> ValidarAsync(UsuarioBiometrico usuario, string captura, CancellationToken ct)
    {
        ComprobarCuenta(usuario);
        var bytes = ImagenBiometrica.Leer(captura);
        var referencia = await ReferenciaAsync(usuario, ct);
        var segmentada = await client.SegmentarAsync(bytes, ct);
        await client.VerificarAsync(referencia, segmentada, ct);
        var actual = await repository.BuscarAsync(null, usuario.Usuario.IdUsuario, ct);
        ComprobarCuenta(actual);
        if (actual!.FotoOriginal != usuario.FotoOriginal || actual.FotoSegmentada != usuario.FotoSegmentada)
            throw new BiometriaException("BIO_CUENTA_CAMBIO", "La foto de referencia cambió. Intenta de nuevo.", 409);
        return actual.Usuario;
    }

    public async Task<byte[]> EnrolarAsync(UsuarioBiometrico usuario, string password, string captura, CancellationToken ct)
    {
        ComprobarCuenta(usuario);
        var auth = await login.ObtenerAutenticacionAsync(usuario.Usuario.Correo);
        if (auth is null || auth.IdUsuario != usuario.Usuario.IdUsuario || auth.Activo != "S" || auth.Bloqueado != "N" ||
            string.IsNullOrEmpty(password) || !LoginService.ValidarPassword(password, auth.PasswordHash))
            throw new BiometriaException("BIO_CREDENCIALES", "La contraseña no es correcta.", 401);
        var original = ImagenBiometrica.Leer(captura);
        var segmentada = await client.SegmentarAsync(original, ct);
        // Una referencia existente nunca se reemplaza por otro rostro.
        if (usuario.FotoSegmentada.HasValue || usuario.FotoOriginal.HasValue)
            await client.VerificarAsync(await ReferenciaAsync(usuario, ct), segmentada, ct);
        await repository.GuardarAsync(usuario, original, segmentada, ct);
        return segmentada;
    }
}
