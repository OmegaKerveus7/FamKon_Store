using System.Globalization;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;
namespace FamKon_store_api.Services;
public static class ConstanciaPdf {
 public static byte[] Crear(JsonElement detail,string web,string tienda) {
  QuestPDF.Settings.License=LicenseType.Community; // Proyecto académico.
  var p=detail.GetProperty("pedido");
  string V(string k)=>p.GetProperty(k).ToString();
  string M(string k)=>"Q "+p.GetProperty(k).GetDecimal().ToString("N2",CultureInfo.InvariantCulture);
  var url=$"{web.TrimEnd('/')}/comprador/tracking?pedido={V("idPedido")}";
  using var qr=QRCodeGenerator.GenerateQrCode(url,QRCodeGenerator.ECCLevel.M);
  var png=new PngByteQRCode(qr).GetGraphic(8);
  return Document.Create(d=>d.Page(page=>{
   page.Size(PageSizes.A4);page.Margin(35);page.DefaultTextStyle(s=>s.FontSize(11));
   page.Header().Background("#0f172a").Padding(18).Text("FamKon | CONSTANCIA DE COMPRA").FontColor(Colors.White).FontSize(19);
   page.Content().PaddingVertical(20).Column(c=>{
    c.Spacing(8);c.Item().Text($"Pedido: {V("numeroPedido")}").Bold();c.Item().Text($"Cliente: {V("cliente")}");c.Item().Text($"Fecha: {V("fechaPedido")}");
    c.Item().Text(V("metodoPago")=="EFECTIVO"?"COD - Contra entrega":"STA - Tarjeta");
    c.Item().Text(V("estadoPago") is "APROBADO" or "PAGADO_EFECTIVO"?"PAGADO - No cobrar al entregar":$"PAGO PENDIENTE - Cobrar {M("total")}").Bold();
    if(V("metodoPago")=="TARJETA"&&V("entorno")=="TEST")c.Item().Text("MODO DE PRUEBA - Sin cobro real");
    c.Item().Text("Entrega: "+(V("idModalidadEntrega")=="1"?tienda:V("direccionEntrega")));
    c.Item().Table(t=>{t.ColumnsDefinition(x=>{x.RelativeColumn(4);x.RelativeColumn();x.RelativeColumn(2);});
     t.Header(h=>{h.Cell().Text("Producto").Bold();h.Cell().Text("Cant.").Bold();h.Cell().Text("Importe").Bold();});
     foreach(var i in detail.GetProperty("productos").EnumerateArray()){t.Cell().PaddingVertical(5).Text(i.GetProperty("nombreProducto").ToString());t.Cell().Text(i.GetProperty("cantidad").ToString());t.Cell().Text("Q "+i.GetProperty("subtotal").GetDecimal().ToString("N2",CultureInfo.InvariantCulture));}});
    c.Item().Text("Subtotal: "+M("subtotal"));c.Item().Text("Entrega: "+M("cargoEntrega"));c.Item().Text("TOTAL: "+M("total")).FontSize(17).Bold();
    c.Item().ShowEntire().Column(q=>{q.Item().Text("SEGUIMIENTO DEL PEDIDO").Bold();q.Item().Width(120).Image(png);q.Item().Hyperlink(url).Text("Abrir tracking del pedido").FontColor(Colors.Blue.Medium);q.Item().Text("Escanea el QR e inicia sesión con tu cuenta para consultar los estados.").FontSize(9);});
    c.Item().Text("Constancia de compra. No sustituye una factura fiscal.").FontSize(9);
   });page.Footer().AlignRight().Text(t=>{t.Span("FamKon | ");t.CurrentPageNumber();});
  })).GeneratePdf();
 }
}
