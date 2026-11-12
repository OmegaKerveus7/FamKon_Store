using FamKon_store_api.Models;
using FamKon_store_api.Services;

namespace FamKon_store_api.Modules.Biometria;

/// <summary>Resultado de la identificación: la cuenta hallada y las referencias comparadas.</summary>
public sealed record ResultadoIdentificacion(Usuario Usuario, long[] Comparados);

public sealed class BiometriaService(
    IBiometriaRepository repository,
    IBiometriaClient client,
    LoginService login,
    ILogger<BiometriaService> logger)
{
    /// Referencia prioritaria (pista o IP) y el resto de la galería.
    private const int PrioridadPista = 1;
    private const int PrioridadIp = 2;
    /// Comparaciones simultáneas en la búsqueda a ciegas (la vía lenta).
    private const int ComparacionesSimultaneas = 3;

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

    public async Task<ResultadoIdentificacion> IdentificarAsync(
        string captura,
        string? pista,
        string? ip,
        IReadOnlyCollection<long> descartados,
        CancellationToken ct)
    {
        var imagen = ImagenBiometrica.Leer(captura);
        using var plazo = CancellationTokenSource.CreateLinkedTokenSource(ct);
        plazo.CancelAfter(TimeSpan.FromSeconds(60));
        var comparados = new List<long>();
        try
        {
            const int maxReferencias = 100;
            var candidatos = await repository.ListarCandidatosAsync(pista, ip, maxReferencias + 1, plazo.Token);
            if (candidatos.Count > maxReferencias)
                throw new BiometriaException("BIO_GALERIA_LIMITE", "La identificación facial no está disponible. Utiliza tu contraseña.", 503);
            if (candidatos.Count == 0)
                throw new BiometriaException("BIO_SIN_REFERENCIA", "Primero inicia sesión con contraseña y registra tu rostro en Mi Perfil.", 409);
            var segmentada = await client.SegmentarAsync(imagen, plazo.Token);

            // La búsqueda prioriza a quien tiene rostro registrado en la galería y
            // ordena por probabilidad de coincidencia: primero la pista y la IP,
            // después el resto. Las referencias ya comparadas en un intento
            // anterior no se repiten.
            var yaDescartados = descartados.ToHashSet();
            var pendientes = candidatos
                .Where(c => !yaDescartados.Contains(c.Usuario.Usuario.IdUsuario))
                .ToList();
            var prioritarios = pendientes.Where(c => c.Prioridad <= PrioridadIp).ToList();
            var resto = pendientes.Where(c => c.Prioridad > PrioridadIp).ToList();
            logger.LogInformation("BIO galeria total={Total} priorizados={Prioritarios} resto={Resto} descartados={Descartados}",
                candidatos.Count, prioritarios.Count, resto.Count, descartados.Count);

            UsuarioBiometrico? coincidencia = null;
            foreach (var candidato in prioritarios)
            {
                plazo.Token.ThrowIfCancellationRequested();
                var id = candidato.Usuario.Usuario.IdUsuario;
                comparados.Add(id);
                if (!await CoincideAsync(candidato.Usuario, segmentada, plazo.Token)) continue;
                if (coincidencia is not null)
                    throw new BiometriaException("BIO_COINCIDENCIA_AMBIGUA", "No se pudo identificar una cuenta única. Inicia sesión con tu contraseña.", 409)
                        { Comparados = comparados.ToArray() };
                coincidencia = candidato.Usuario;
                // Con pista o IP la coincidencia es suficiente: no se sigue
                // recorriendo la galería completa.
                break;
            }

            if (coincidencia is null && resto.Count > 0)
            {
                // Búsqueda a ciegas: se compara de a varias referencias a la vez
                // para no depender del tamaño de la galería.
                var cola = new Queue<CandidatoBiometrico>(resto);
                while (cola.Count > 0 && coincidencia is null)
                {
                    plazo.Token.ThrowIfCancellationRequested();
                    var tanda = new List<Task<UsuarioBiometrico?>>();
                    for (int i = 0; i < ComparacionesSimultaneas && cola.Count > 0; i++)
                    {
                        var candidato = cola.Dequeue();
                        comparados.Add(candidato.Usuario.Usuario.IdUsuario);
                        tanda.Add(CompararAsync(candidato.Usuario, segmentada, plazo.Token));
                    }
                    var hallazgos = (await Task.WhenAll(tanda)).Where(c => c is not null).ToList();
                    if (hallazgos.Count > 1)
                        throw new BiometriaException("BIO_COINCIDENCIA_AMBIGUA", "No se pudo identificar una cuenta única. Inicia sesión con tu contraseña.", 409)
                            { Comparados = comparados.ToArray() };
                    coincidencia = hallazgos.FirstOrDefault();
                }
            }

            if (coincidencia is null)
                throw new BiometriaException("BIO_NO_COINCIDE", "No encontramos una cuenta que coincida con tu rostro. Intenta de nuevo o utiliza tu contraseña.", 401)
                    { Comparados = comparados.ToArray() };
            var actual = await repository.BuscarAsync(null, coincidencia.Usuario.IdUsuario, plazo.Token);
            ComprobarCuenta(actual);
            if (actual!.FotoOriginal != coincidencia.FotoOriginal || actual.FotoSegmentada != coincidencia.FotoSegmentada)
                throw new BiometriaException("BIO_CUENTA_CAMBIO", "La foto de referencia cambió. Intenta de nuevo.", 409);
            return new ResultadoIdentificacion(actual.Usuario, comparados.ToArray());
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new BiometriaException("BIO_TIMEOUT", "No se pudo completar la identificación a tiempo. Intenta de nuevo o utiliza tu contraseña.", 504)
                { Comparados = comparados.ToArray() };
        }
    }

    /// <summary>Compara la captura con una referencia: true si el rostro coincide.</summary>
    private async Task<bool> CoincideAsync(UsuarioBiometrico usuario, byte[] segmentada, CancellationToken ct)
    {
        var referencia = await ReferenciaAsync(usuario, ct);
        try
        {
            await client.VerificarAsync(referencia, segmentada, ct);
            logger.LogInformation("BIO comparar usuario={Id} coincidencia=S", usuario.Usuario.IdUsuario);
            return true;
        }
        catch (BiometriaException ex) when (ex.Codigo == "BIO_NO_COINCIDE")
        {
            logger.LogInformation("BIO comparar usuario={Id} coincidencia=N", usuario.Usuario.IdUsuario);
            return false;
        }
    }

    private async Task<UsuarioBiometrico?> CompararAsync(UsuarioBiometrico usuario, byte[] segmentada, CancellationToken ct)
    {
        var referencia = await ReferenciaAsync(usuario, ct);
        try { await client.VerificarAsync(referencia, segmentada, ct); return usuario; }
        catch (BiometriaException ex) when (ex.Codigo == "BIO_NO_COINCIDE") { return null; }
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
