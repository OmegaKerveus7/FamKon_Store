using FamKon_store_api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseOracle(builder.Configuration.GetConnectionString("Oracle")));
builder.Services.AddScoped<IUsuarioRepository>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    return new UsuarioRepository(configuration);
});
builder.Services.AddHttpClient<FamKon_store_api.Services.BiometricService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("PermitirFrontend");
app.UseAuthorization();

app.MapControllers();

app.Run();