using FamKon_store_api.Models;
using Microsoft.EntityFrameworkCore;

namespace FamKon_store_api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Usuario> Usuarios => Set<Usuario>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Usuario>(entity =>
            {
                entity.ToTable("USUARIOS");
                entity.HasKey(u => u.Id);

                entity.Property(u => u.Id)
                    .ValueGeneratedOnAdd();

                entity.Property(u => u.Nombre)
                    .HasColumnName("NOMBRE")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(u => u.Correo)
                    .HasColumnName("CORREO")
                    .HasMaxLength(200);

                entity.Property(u => u.NombreUsuario)
                    .HasColumnName("NOMBRE_USUARIO")
                    .HasMaxLength(100);

                entity.Property(u => u.Contrasena)
                    .HasColumnName("CONTRASENA")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(u => u.ImagenOriginalBase64)
                    .HasColumnName("IMAGEN_ORIGINAL")
                    .HasColumnType("CLOB");

                entity.Property(u => u.CodigoQr)
                    .HasColumnName("CODIGO_QR")
                    .HasMaxLength(100);

                entity.Property(u => u.Rol)
                    .HasColumnName("ROL");

                entity.HasIndex(u => u.Correo);
                entity.HasIndex(u => u.NombreUsuario);
                entity.HasIndex(u => u.CodigoQr);
            });
        }
    }
}