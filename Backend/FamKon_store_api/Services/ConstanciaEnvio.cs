using System.Security.Cryptography;
using System.Text.Json;
using Oracle.ManagedDataAccess.Client;
namespace FamKon_store_api.Services;
public class ConstanciaEnvio(CompraService compras,EmailService email,WhatsAppService whatsapp,IConfiguration config) {
 public static async Task Encolar(OracleConnection c,long id) {
  using var p=CompraService.Comando(c,"SELECT P.ID_USUARIO,MP.CODIGO METODO,EP.CODIGO ESTADO FROM PEDIDO P JOIN PAGO G ON G.ID_PEDIDO=P.ID_PEDIDO JOIN METODO_PAGO MP ON MP.ID_METODO_PAGO=G.ID_METODO_PAGO JOIN ESTADO_PAGO EP ON EP.ID_ESTADO_PAGO=G.ID_ESTADO_PAGO WHERE P.ID_PEDIDO=:id",("id",id));
  var row=(await CompraService.Leer(p)).FirstOrDefault();
  if(row is null || ((string?)row["metodo"]!="EFECTIVO"&&(string?)row["estado"]!="APROBADO"))return;
  foreach(var canal in new[]{"EMAIL","WHATSAPP"}) {
   var field=canal=="EMAIL"?"CORREO":"TELEFONO";
   using var cmd=CompraService.Comando(c,$"""
    MERGE INTO COMPRA_CONSTANCIA D USING (SELECT :id ID_PEDIDO,:canal CANAL,U.{field} DESTINO FROM USUARIO U WHERE U.ID_USUARIO=:usuario AND U.NOTIFICA_{canal}='S' AND U.{field} IS NOT NULL) S
    ON (D.ID_PEDIDO=S.ID_PEDIDO AND D.CANAL=S.CANAL)
    WHEN NOT MATCHED THEN INSERT(ID_PEDIDO,CANAL,DESTINO) VALUES(S.ID_PEDIDO,S.CANAL,S.DESTINO)
    """,("id",id),("canal",canal),("usuario",row["idUsuario"]));
   await cmd.ExecuteNonQueryAsync();
  }
 }
 public async Task Procesar() {
  var web=config["Constancias:FrontendUrl"];
  if(!Uri.TryCreate(web,UriKind.Absolute,out var uri)||uri.Scheme!="https")return;
  using var c=await compras.Abrir();
  using var list=CompraService.Comando(c,"SELECT ID_PEDIDO,CANAL FROM COMPRA_CONSTANCIA WHERE ESTADO='PENDIENTE' ORDER BY CREADO FETCH FIRST 10 ROWS ONLY");
  var rows=await CompraService.Leer(list);
  foreach(var row in rows) {
   var id=Convert.ToInt64(row["idPedido"]);var canal=(string)row["canal"]!;
   var api=config["Constancias:PublicApiUrl"];
   if(canal=="WHATSAPP"&&(!Uri.TryCreate(api,UriKind.Absolute,out var apiUri)||apiUri.Scheme!="https"))continue;
   var resumen=await compras.Resumen(id);if(resumen is null)continue;
   if((string?)resumen["estado"]=="CANCELADO" || ((string?)resumen["metodoPago"]=="TARJETA" && (string?)resumen["estadoPago"]!="APROBADO")) {using var cancel=CompraService.Comando(c,"UPDATE COMPRA_CONSTANCIA SET ESTADO='CANCELADO' WHERE ID_PEDIDO=:id AND CANAL=:canal AND ESTADO='PENDIENTE'",("id",id),("canal",canal));await cancel.ExecuteNonQueryAsync();continue;}
   var detail=await compras.Detalle(id,Convert.ToInt64(resumen["idUsuario"]),"cliente");if(detail is null)continue;
   var pdf=ConstanciaPdf.Crear(JsonSerializer.SerializeToElement(detail),web!,config["Tienda:Direccion"]??"Campus central");
   var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
   string destino;
   using(var tx=c.BeginTransaction()) {
    using var claim=CompraService.Comando(c,"UPDATE COMPRA_CONSTANCIA SET ESTADO='ENVIANDO',PDF=:pdf,TOKEN=:token,EXPIRA=SYSTIMESTAMP+INTERVAL '2' DAY WHERE ID_PEDIDO=:id AND CANAL=:canal AND ESTADO='PENDIENTE'",("token",token),("id",id),("canal",canal));
    claim.Parameters.Add("pdf",OracleDbType.Blob).Value=pdf;
    if(await claim.ExecuteNonQueryAsync()!=1){tx.Rollback();continue;}
    using var dest=CompraService.Comando(c,"SELECT DESTINO FROM COMPRA_CONSTANCIA WHERE ID_PEDIDO=:id AND CANAL=:canal",("id",id),("canal",canal));destino=(string)(await dest.ExecuteScalarAsync())!;tx.Commit();
   }
   // ENVIANDO se conserva ante cierre inesperado: no repetir mensajes de resultado incierto.
   var ok=canal=="EMAIL"?await email.EnviarConstanciaAsync(destino,id,pdf):await whatsapp.EnviarConstanciaAsync(destino,id,$"{api!.TrimEnd('/')}/api/famkon/constancias/documento/{token}");
   using var save=CompraService.Comando(c,"UPDATE COMPRA_CONSTANCIA SET ESTADO=:estado WHERE ID_PEDIDO=:id AND CANAL=:canal",("estado",ok?"ENVIADO":"ERROR"),("id",id),("canal",canal));await save.ExecuteNonQueryAsync();
  }
 }
}
public class ConstanciaWorker(IServiceScopeFactory scopes,ILogger<ConstanciaWorker> logger):BackgroundService {
 protected override async Task ExecuteAsync(CancellationToken stop) {
  while(!stop.IsCancellationRequested) {
   try{using var scope=scopes.CreateScope();await scope.ServiceProvider.GetRequiredService<ConstanciaEnvio>().Procesar();}
   catch(Exception ex){logger.LogWarning("No se pudo procesar la cola de constancias ({Tipo}).",ex.GetType().Name);}
   try{using var scope=scopes.CreateScope();await scope.ServiceProvider.GetRequiredService<CredencialService>().Procesar();}
   catch(Exception ex){logger.LogWarning("No se pudo procesar la cola de credenciales ({Tipo}).",ex.GetType().Name);}
   try{await Task.Delay(TimeSpan.FromSeconds(30),stop);}catch(OperationCanceledException){break;}
  }
 }
}
