using FamKon_store_api.Modules.Biometria;
using FamKon_store_api.BD;
using FamKon_store_api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

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
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddScoped<IPasswordRecoveryStore, PasswordRecoveryStore>();
builder.Services.AddScoped<IPasswordCodeSender, PasswordCodeSender>();
builder.Services.AddScoped<PasswordRecoveryService>();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("password", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = 429;
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
builder.Services.AddScoped<ConstanciaEnvio>();
builder.Services.AddScoped<CredencialService>();
builder.Services.AddSingleton<RegistroRostroService>();
builder.Services.AddHostedService<ConstanciaWorker>();
builder.Services.AddHttpClient<IRecaptchaVerifier, RecaptchaService>(client => client.Timeout = TimeSpan.FromSeconds(10));
builder.Services.AddScoped<FamKon_store_api.Controllers.CompraExceptionFilter>();
builder.Services.AddHttpClient<RecurrenteService>(client => client.Timeout = TimeSpan.FromSeconds(25));

builder.Services.AddHttpClient<FamKon_store_api.Services.BiometricService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddHttpClient<FamKon_store_api.Services.WhatsAppService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

builder.Services.AddHttpClient("BrevoApi", client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddScoped<FamKon_store_api.Services.EmailService>();

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
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("PermitirFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();
