using FamKon_store_api.Modules.Biometria;
using FamKon_store_api.BD;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

internal class Program
{
    private static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.MaxDepth = 64;
            });

        builder.Services.Configure<Microsoft.AspNetCore.Server.Kestrel.Core.KestrelServerOptions>(options =>
        {
            options.Limits.MaxRequestBufferSize = 10 * 1024 * 1024;
            options.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
        });

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("PermitirFrontend", policy =>
                policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
        });

        builder.Services.AddSingleton<DBContext>();
        builder.Services.AddSingleton<JwtService>();
        builder.Services.AddScoped<LoginService>();
        builder.Services.AddScoped<UsuarioService>();
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddScoped<IPasswordRecoveryStore, PasswordRecoveryStore>();
        builder.Services.AddScoped<IPasswordCodeSender, PasswordCodeSender>();
        builder.Services.AddScoped<PasswordRecoveryService>();
        // Límites ajustables con RateLimit:* en appsettings (peticiones por minuto).
        var limiteIpPorMinuto = builder.Configuration.GetValue("RateLimit:IpPorMinuto", 240);
        var limiteUsuarioPorMinuto = builder.Configuration.GetValue("RateLimit:UsuarioPorMinuto", 300);
        var limiteAuthPorMinuto = builder.Configuration.GetValue("RateLimit:AuthPorMinuto", 10);
        builder.Services.AddRateLimiter(options =>
        {
            options.AddPolicy("rastreo", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            options.AddPolicy("password", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
            // Login, registro y envío de códigos: pocas veces por minuto y por IP.
            options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limiteAuthPorMinuto, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
            // Tope general para todo el API: por IP y, si hay token, también por usuario
            // (cubre a quien rote de IP con un mismo token). Se aplica el más restrictivo.
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPartition.GetSlidingWindowLimiter(
                    "ip:" + (context.Connection.RemoteIpAddress?.ToString() ?? "unknown"),
                    _ => new SlidingWindowRateLimiterOptions { PermitLimit = limiteIpPorMinuto, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 })),
                PartitionedRateLimiter.Create<HttpContext, string>(context =>
                {
                    var usuario = context.User.FindFirst("sub")?.Value;
                    return string.IsNullOrEmpty(usuario)
                        ? RateLimitPartition.GetNoLimiter("anonimo")
                        : RateLimitPartition.GetSlidingWindowLimiter(
                            "usr:" + usuario,
                            _ => new SlidingWindowRateLimiterOptions { PermitLimit = limiteUsuarioPorMinuto, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 });
                }));
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = 429;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var espera))
                    context.HttpContext.Response.Headers.RetryAfter = ((int)espera.TotalSeconds).ToString();
                await context.HttpContext.Response.WriteAsJsonAsync(new { mensaje = "Demasiadas solicitudes. Espera unos minutos antes de intentar de nuevo." }, cancellationToken);
            };
        });
        builder.Services.AddScoped<BiometriaRepository>();
        builder.Services.AddScoped<IBiometriaRepository>(sp => sp.GetRequiredService<BiometriaRepository>());
        builder.Services.AddScoped<BiometriaService>();
        builder.Services.AddHttpClient<IBiometriaClient, BiometriaClient>(client => client.Timeout = TimeSpan.FromSeconds(30));
        builder.Services.AddScoped<UsuarioAdminService>();
        builder.Services.AddScoped<PermisoService>();
        builder.Services.AddScoped<BitacoraService>();
        builder.Services.AddScoped<CatalogoService>();
        builder.Services.AddScoped<CarritoService>();
        builder.Services.AddScoped<PedidoService>();
        builder.Services.AddScoped<RepartidorService>();
        builder.Services.AddScoped<ArchivoService>();
        builder.Services.AddScoped<CompraService>();
        builder.Services.AddScoped<PersonalizacionService>();
        builder.Services.AddScoped<ConstanciaEnvio>();
        builder.Services.AddScoped<CredencialService>();
        builder.Services.AddSingleton<RegistroRostroService>();
        builder.Services.AddHostedService<ConstanciaWorker>();
        builder.Services.AddHttpClient<IRecaptchaVerifier, RecaptchaService>(client => client.Timeout = TimeSpan.FromSeconds(10));
        builder.Services.AddScoped<FamKon_store_api.Controllers.CompraExceptionFilter>();
        builder.Services.AddHttpClient<RecurrenteService>(client => client.Timeout = TimeSpan.FromSeconds(25));

        builder.Services.AddHttpClient<BiometricService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        builder.Services.AddHttpClient<WhatsAppService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        builder.Services.AddHttpClient("BrevoApi", client => client.Timeout = TimeSpan.FromSeconds(30));
        builder.Services.AddScoped<EmailService>();

        var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]!;
        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
                ValidateIssuer = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = builder.Configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
                NameClaimType = "sub"
            };
        });

        builder.Services.AddAuthorization();
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            // Nginx (mismo servidor) ya envía X-Forwarded-For y X-Forwarded-Proto.
            // Solo se confían los proxies conocidos (loopback) para no aceptar
            // cabeceras arbitrarias de los clientes.
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            // En el VPS nginx llega al contenedor por el bridge de Docker (172.16.0.0/12), no por loopback.
            options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse("172.16.0.0"), 12));
        });
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.IgnoreObsoleteActions();
            options.IgnoreObsoleteProperties();
            // Evita colisiones cuando distintos controladores tienen DTO con el mismo nombre.
            options.CustomSchemaIds(type => type.FullName!.Replace('+', '.'));
        });

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseForwardedHeaders();
        app.UseCors("PermitirFrontend");
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();

        app.MapControllers();

        app.Run();
    }
}