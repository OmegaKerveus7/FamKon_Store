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
                    .HasColumnName("ID_USUARIO")
                    .ValueGeneratedOnAdd();

                entity.Property(u => u.Nombres)
                    .HasColumnName("NOMBRES")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(u => u.Apellidos)
                    .HasColumnName("APELLIDOS")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(u => u.Correo)
                    .HasColumnName("CORREO")
                    .HasMaxLength(200);

                entity.Property(u => u.Nickname)
                    .HasColumnName("NICKNAME")
                    .HasMaxLength(100);

                entity.Property(u => u.Contrasena)
                    .HasColumnName("CONTRASEÑA")
                    .HasMaxLength(200)
                    .IsRequired();

                entity.Property(u => u.FotoOriginal)
                    .HasColumnName("FOTO_O")
                    .HasColumnType("CLOB");

                entity.Property(u => u.FotoEditada)
                    .HasColumnName("FOTO_E")
                    .HasColumnType("CLOB");

                entity.Property(u => u.CodigoQr)
                    .HasColumnName("CODIGO_QR")
                    .HasMaxLength(8);

                entity.Property(u => u.Role)
                    .HasColumnName("ROLE");

                entity.Property(u => u.FechaNacimiento)
                    .HasColumnName("FECHA_NACAIMIENTO");

                entity.HasIndex(u => u.Correo);
                entity.HasIndex(u => u.Nickname);
                entity.HasIndex(u => u.CodigoQr);
            });
        }
    }
}
