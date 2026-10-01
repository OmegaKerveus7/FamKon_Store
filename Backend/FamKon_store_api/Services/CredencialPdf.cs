using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;
namespace FamKon_store_api.Services;
public static class CredencialPdf {
 public static string ColorTema(string tema)=>tema switch {"AZUL"=>"#0f172a","NARANJA"=>"#9a3412","MORADO"=>"#581c87",_=>throw new InvalidOperationException("Selecciona un diseño válido para tu credencial.")};
 public static byte[] Crear(long id,string nickname,byte[] foto,string token,DateTimeOffset fecha,string tema="AZUL") {
  QuestPDF.Settings.License=LicenseType.Community;
  using var data=QRCodeGenerator.GenerateQrCode(token,QRCodeGenerator.ECCLevel.M);
  var qr=new PngByteQRCode(data).GetGraphic(8);
  return Document.Create(d=>d.Page(p=>{
   p.Size(PageSizes.A5);p.Margin(25);p.DefaultTextStyle(t=>t.FontSize(11));
   p.Header().Background(ColorTema(tema)).Padding(12).Row(r=>{
    r.ConstantItem(32).Image(Path.Combine(AppContext.BaseDirectory,"Assets","logo-famkon.png"));
    r.RelativeItem().PaddingLeft(10).AlignMiddle().Text("FamKon | MI CREDENCIAL").FontColor(Colors.White).FontSize(16);
   });
   p.Content().PaddingTop(18).Column(c=>{
    c.Spacing(8);c.Item().AlignCenter().Width(90).Height(120).Image(foto).FitArea();
    c.Item().AlignCenter().Text(nickname).FontSize(20).Bold();
    c.Item().AlignCenter().Text($"COMPRADOR | FK-{id:D6}").FontColor("#b45309");
    c.Item().AlignCenter().Text($"Emitida: {fecha:dd/MM/yyyy}").FontSize(9);
    c.Item().AlignCenter().Width(105).Image(qr);
    c.Item().AlignCenter().Text("Escanea este QR en Acceso con credencial").Bold();
    c.Item().Text("Documento personal: este QR permite entrar a tu cuenta. No lo compartas. Si lo pierdes, reemplázalo desde Mi perfil.").FontSize(9);
   });p.Footer().AlignCenter().Text("FamKon - Tu identidad, tu estilo").FontSize(9);
  })).GeneratePdf();
 }
}
