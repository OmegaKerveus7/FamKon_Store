using System.Globalization;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QRCoder;
namespace FamKon_store_api.Services;
public static class ConstanciaPdf {
 public static byte[] Crear(JsonElement detail,string web,string tienda) {
  QuestPDF.Settings.License=LicenseType.Community;
  var p=detail.GetProperty("pedido");
  string V(string k)=>p.TryGetProperty(k,out var v)?v.ToString():"";
  string Money(decimal n)=>"Q "+n.ToString("N2",CultureInfo.InvariantCulture);
  string M(string k)=>Money(p.GetProperty(k).GetDecimal());
  var paid=V("estadoPago") is "APROBADO" or "PAGADO_EFECTIVO";
  var fecha=DateTimeOffset.TryParse(V("fechaPedido"),CultureInfo.InvariantCulture,out var date)
   ?TimeZoneInfo.ConvertTime(date,TimeZoneInfo.FindSystemTimeZoneById("America/Guatemala")).ToString("d 'de' MMMM 'de' yyyy, HH:mm",CultureInfo.GetCultureInfo("es-GT")):V("fechaPedido");
  var direccion=V("idModalidadEntrega")=="1"?tienda:string.Join(", ",new[]{V("direccionEntrega"),V("municipio"),V("departamento")}.Where(x=>!string.IsNullOrWhiteSpace(x)));
  var url=$"{web.TrimEnd('/')}/rastreo?guia={Uri.EscapeDataString(V("numeroPedido"))}";
  using var qr=QRCodeGenerator.GenerateQrCode(url,QRCodeGenerator.ECCLevel.M);
  var png=new PngByteQRCode(qr).GetGraphic(8);
  void Label(ColumnDescriptor c,string label,string value) { c.Item().Text(label.ToUpperInvariant()).FontSize(8).Bold().FontColor("#64748b");c.Item().PaddingTop(5).Text(value).FontSize(10); }
  void Title(ColumnDescriptor c,string title) { c.Item().PaddingTop(8).PaddingBottom(10).BorderBottom(1).BorderColor("#e2e8f0").Text(title).Bold().FontSize(11); }
  return Document.Create(d=>d.Page(page=>{
   page.Size(PageSizes.A4);page.MarginHorizontal(50);page.MarginVertical(30);page.DefaultTextStyle(s=>s.FontSize(10).FontColor("#1e293b"));
   page.Header().Background("#0f172a").BorderBottom(7).BorderColor("#f97316").PaddingHorizontal(18).PaddingVertical(25).Row(r=>{
    r.RelativeItem().Column(c=>{c.Item().Text("FamKon").FontSize(25).Bold().FontColor(Colors.White);c.Item().PaddingTop(5).Text("TIENDA EN LÍNEA").FontSize(9).FontColor("#cbd5e1");});
    r.RelativeItem(2).AlignRight().Column(c=>{c.Item().AlignRight().Text("COMPROBANTE DE COMPRA").FontSize(15).Bold().FontColor(Colors.White);c.Item().PaddingTop(8).AlignRight().Text("Pedido "+V("numeroPedido")).FontSize(9).FontColor("#cbd5e1");});
   });
   page.Content().PaddingTop(20).PaddingBottom(15).Column(c=>{
    c.Spacing(10);
    c.Item().Background("#f8fafc").Padding(16).Column(info=>{
     info.Item().Row(r=>{r.RelativeItem().Column(x=>Label(x,"Comprador",V("cliente")));r.RelativeItem().Column(x=>Label(x,"Fecha",fecha));});
     info.Item().PaddingTop(15).Text(t=>{t.Span("ESTADO DEL PAGO   ").FontSize(8).Bold().FontColor("#64748b");t.Span(paid?"PAGADO - No cobrar al entregar":"PENDIENTE - COBRAR "+M("total")).FontSize(9).Bold().FontColor(paid?"#047857":"#b45309");});
    });
    Title(c,"ENTREGA Y PAGO");
    c.Item().Row(r=>{r.RelativeItem().Column(x=>Label(x,"Modalidad",V("idModalidadEntrega")=="1"?"Recoger en tienda":"Envío a domicilio"));r.RelativeItem().Column(x=>Label(x,"Método de pago",V("metodoPago")=="EFECTIVO"?"Efectivo contra entrega":"Tarjeta"));});
    c.Item().PaddingVertical(5).Column(x=>Label(x,"Dirección de entrega",direccion));
    if(V("metodoPago")=="TARJETA"&&V("entorno")=="TEST")c.Item().Background("#fff7ed").Padding(10).Text("MODO DE PRUEBA - SIN COBRO REAL").FontSize(8).Bold().FontColor("#9a3412");
    Title(c,"DETALLE DE PRODUCTOS");
    c.Item().Table(t=>{
     t.ColumnsDefinition(x=>{x.RelativeColumn(5);x.RelativeColumn();x.RelativeColumn(1.7f);x.RelativeColumn(1.7f);});
     t.Header(h=>{foreach(var label in new[]{"PRODUCTO","CANT.","PRECIO","IMPORTE"})h.Cell().Background("#f1f5f9").Padding(8).Text(label).FontSize(8).Bold().FontColor("#475569");});
     foreach(var i in detail.GetProperty("productos").EnumerateArray()){
      decimal N(string k)=>i.TryGetProperty(k,out var v)?v.GetDecimal():0;
      t.Cell().BorderBottom(1).BorderColor("#f1f5f9").Padding(8).Text(i.GetProperty("nombreProducto").ToString()).FontSize(9);
      t.Cell().Padding(8).Text(i.GetProperty("cantidad").ToString()).FontSize(9);
      t.Cell().Padding(8).Text(Money(N("precioUnitario")+N("precioPersonaliza"))).FontSize(9);
      t.Cell().Padding(8).AlignRight().Text(Money(N("subtotal"))).FontSize(9).Bold();
     }
    });
    c.Item().PaddingTop(5).ShowEntire().Row(r=>{
     r.RelativeItem(1.2f).Background("#f8fafc").Padding(10).Row(q=>{q.ConstantItem(95).Image(png);q.RelativeItem().PaddingLeft(8).Column(x=>{x.Item().PaddingTop(6).Text("RASTREA TU PEDIDO").FontSize(8).Bold();x.Item().PaddingTop(10).Text("Escanea el QR para consultar el estado actualizado de tu compra.").FontSize(8);x.Item().PaddingTop(12).Hyperlink(url).Text("Abrir tracking").FontSize(8).Bold().FontColor("#c2410c");});});
     r.ConstantItem(20);r.RelativeItem().PaddingTop(10).Column(x=>{
      x.Item().Row(a=>{a.RelativeItem().Text("Subtotal");a.AutoItem().Text(M("subtotal"));});
      x.Item().PaddingTop(10).Row(a=>{a.RelativeItem().Text("Entrega");a.AutoItem().Text(M("cargoEntrega"));});
      x.Item().PaddingTop(12).BorderTop(1).BorderColor("#cbd5e1").PaddingTop(15).Row(a=>{a.RelativeItem().Text("TOTAL").FontSize(15).Bold();a.AutoItem().Text(M("total")).FontSize(15).Bold().FontColor("#ea580c");});
     });
    });
   });
   page.Footer().BorderTop(1).BorderColor("#e2e8f0").PaddingTop(10).Row(r=>{r.RelativeItem().Text("Comprobante de compra. No sustituye una factura fiscal.").FontSize(7).FontColor("#64748b");r.AutoItem().Text(t=>{t.DefaultTextStyle(s=>s.FontSize(7).FontColor("#64748b"));t.Span(V("numeroPedido")+" · ");t.CurrentPageNumber();t.Span("/");t.TotalPages();});});
  })).GeneratePdf();
 }
}
