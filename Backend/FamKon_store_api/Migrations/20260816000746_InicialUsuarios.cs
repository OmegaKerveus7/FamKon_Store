using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FamKon_store_api.Migrations
{
    /// <inheritdoc />
    public partial class InicialUsuarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "USUARIOS",
                columns: table => new
                {
                    Id = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    NOMBRE = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    CORREO = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: true),
                    NOMBRE_USUARIO = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    CONTRASENA = table.Column<string>(type: "NVARCHAR2(200)", maxLength: 200, nullable: false),
                    IMAGEN_ORIGINAL = table.Column<string>(type: "CLOB", nullable: false),
                    CODIGO_QR = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ROL = table.Column<int>(type: "NUMBER(10)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USUARIOS", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_USUARIOS_CODIGO_QR",
                table: "USUARIOS",
                column: "CODIGO_QR");

            migrationBuilder.CreateIndex(
                name: "IX_USUARIOS_CORREO",
                table: "USUARIOS",
                column: "CORREO");

            migrationBuilder.CreateIndex(
                name: "IX_USUARIOS_NOMBRE_USUARIO",
                table: "USUARIOS",
                column: "NOMBRE_USUARIO");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "USUARIOS");
        }
    }
}
