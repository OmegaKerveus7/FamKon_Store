using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;

namespace FamKon_store_api.Services;

public static class CredencialPdf
{
    public static string ColorTema(string tema) => tema switch
    {
        "AZUL" => "#0f172a",
        "NARANJA" => "#9a3412",
        "MORADO" => "#581c87",
        _ => throw new InvalidOperationException("Selecciona un diseño válido para tu credencial.")
    };

    private static string ColorAcento(string tema) => tema switch
    {
        "AZUL" => "#fb923c",
        "NARANJA" => "#fdba74",
        "MORADO" => "#d8b4fe",
        _ => "#fb923c"
    };

    public static byte[] Crear(long id, string nickname, byte[] foto, string token, DateTimeOffset fecha, string tema = "AZUL")
    {
        QuestPDF.Settings.License = LicenseType.Community;
        using var data = QRCodeGenerator.GenerateQrCode(token, QRCodeGenerator.ECCLevel.M);
        var qr = new PngByteQRCode(data).GetGraphic(8);
        var principal = ColorTema(tema);
        var acento = ColorAcento(tema);
        var logo = Path.Combine(AppContext.BaseDirectory, "Assets", "logo-famkon.png");

        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A6.Landscape());
            page.Margin(0);
            page.DefaultTextStyle(text => text.FontSize(10).FontColor("#0f172a"));

            page.Header()
                .Height(62)
                .Background(principal)
                .PaddingHorizontal(20)
                .AlignMiddle()
                .Row(row =>
                {
                    row.ConstantItem(38).Height(38).Background(Colors.White).Padding(4).Image(logo).FitArea();
                    row.RelativeItem().PaddingLeft(12).Column(column =>
                    {
                        column.Item().Text("FamKon").FontSize(17).ExtraBold().FontColor(Colors.White);
                        column.Item().Text("CREDENCIAL DIGITAL").FontSize(7).SemiBold().FontColor("#cbd5e1").LetterSpacing(0.18f);
                    });
                    row.AutoItem().AlignMiddle().Background(acento).PaddingHorizontal(10).PaddingVertical(5)
                        .Text("ACCESO SEGURO").FontSize(7).Bold().FontColor(principal);
                });

            page.Content()
                .Background("#f8fafc")
                .Padding(18)
                .Row(row =>
                {
                    row.ConstantItem(86).Column(column =>
                    {
                        column.Item().Height(112).Border(3).BorderColor(Colors.White).Background("#e2e8f0").Image(foto).FitArea();
                        column.Item().PaddingTop(7).AlignCenter().Background("#dcfce7").PaddingVertical(4)
                            .Text("IDENTIDAD VERIFICADA").FontSize(6).Bold().FontColor("#166534");
                    });

                    row.RelativeItem().PaddingLeft(17).PaddingRight(12).Column(column =>
                    {
                        column.Item().Text("TITULAR").FontSize(7).Bold().FontColor("#94a3b8").LetterSpacing(0.15f);
                        column.Item().PaddingTop(3).Text(nickname).FontSize(18).ExtraBold().FontColor("#0f172a");
                        column.Item().PaddingTop(5).Text("COMPRADOR").FontSize(9).Bold().FontColor(principal);
                        column.Item().PaddingTop(10).BorderTop(1).BorderColor("#e2e8f0").PaddingTop(8).Column(info =>
                        {
                            info.Item().Text($"FK-{id:D6}").FontSize(11).Bold();
                            info.Item().PaddingTop(2).Text($"Emitida el {fecha.ToOffset(TimeSpan.FromHours(-6)):dd/MM/yyyy}").FontSize(7).FontColor("#64748b");
                        });
                    });

                    row.ConstantItem(86).AlignMiddle().Column(column =>
                    {
                        column.Item().AlignCenter().Width(78).Height(78).Background(Colors.White).Padding(5).Image(qr).FitArea();
                        column.Item().PaddingTop(6).AlignCenter().Text("ESCANEA PARA INGRESAR").FontSize(6).Bold().FontColor(principal);
                        column.Item().PaddingTop(2).AlignCenter().Text("No compartas este código").FontSize(6).FontColor("#64748b");
                    });
                });

            page.Footer()
                .Height(30)
                .Background(principal)
                .PaddingHorizontal(20)
                .AlignMiddle()
                .Row(row =>
                {
                    row.RelativeItem().Text("FamKon · Tu identidad, tu estilo").FontSize(7).SemiBold().FontColor(Colors.White);
                    row.AutoItem().Text("Documento personal").FontSize(7).FontColor("#cbd5e1");
                });
        })).GeneratePdf();
    }
}
