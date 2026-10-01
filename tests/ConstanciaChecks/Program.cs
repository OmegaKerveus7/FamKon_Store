using Microsoft.Extensions.Configuration;

using System.Text.Json;
using FamKon_store_api.Services;
foreach(var metodo in new[]{"EFECTIVO","TARJETA"}) {
 var detail=JsonSerializer.SerializeToElement(new{pedido=new{idPedido=61,numeroPedido="FK-DEMO-61",cliente="Comprador de prueba",fechaPedido="2026-09-30",metodoPago=metodo,estadoPago=metodo=="EFECTIVO"?"PENDIENTE":"APROBADO",entorno="TEST",idModalidadEntrega=1,direccionEntrega="",subtotal=59.98m,cargoEntrega=0m,total=59.98m},productos=Enumerable.Range(1,metodo=="EFECTIVO"?2:65).Select(i=>new{nombreProducto="Producto personalizado de ejemplo "+i,cantidad=1,subtotal=29.99m})});
 var pdf=ConstanciaPdf.Crear(detail,"https://famkon.site","Campus central");
 if(System.Text.Encoding.ASCII.GetString(pdf,0,4)!="%PDF"||pdf.Length<1000)throw new Exception("PDF inválido");
 File.WriteAllBytes($"/tmp/constancia-backend-{metodo}.pdf",pdf);
 Console.WriteLine($"PDF {metodo}: OK ({pdf.Length} bytes)");
}
if(args.Contains("--oracle")) {
 var cfg=new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddJsonFile(Path.GetFullPath("Backend/FamKon_store_api/appsettings.json")).Build();
 using var c=new FamKon_store_api.BD.DBContext(cfg).CreateConnection();await c.OpenAsync();using var tx=c.BeginTransaction();
 using var find=CompraService.Comando(c,"SELECT P.ID_PEDIDO FROM PEDIDO P JOIN PAGO G ON G.ID_PEDIDO=P.ID_PEDIDO JOIN METODO_PAGO M ON M.ID_METODO_PAGO=G.ID_METODO_PAGO WHERE M.CODIGO='EFECTIVO' FETCH FIRST 1 ROW ONLY");
 var value=await find.ExecuteScalarAsync();if(value is null)throw new Exception("Sin pedido COD para comprobación");var id=Convert.ToInt64(value);
 await ConstanciaEnvio.Encolar(c,id);
 using var count=CompraService.Comando(c,"SELECT COUNT(*) FROM COMPRA_CONSTANCIA WHERE ID_PEDIDO=:id",("id",id));var before=Convert.ToInt32(await count.ExecuteScalarAsync());
 await ConstanciaEnvio.Encolar(c,id);var after=Convert.ToInt32(await count.ExecuteScalarAsync());if(before!=after||before==0)throw new Exception("Cola no idempotente o sin preferencia");
 tx.Rollback();Console.WriteLine("Oracle: encolado y repetición OK; rollback, ningún mensaje enviado.");
}
