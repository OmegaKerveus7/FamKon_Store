using FamKon_store_api.Services;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
var cfg=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Credencial:EncryptionKey"]=Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}).Build();
var service=new CredencialService(null!,cfg,null!,null!);
var image=File.ReadAllBytes("Fronted/public/images/logo-famkon.png");
var valid=CredencialService.Imagen(Convert.ToBase64String(image));
var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
var pdf=CredencialPdf.Crear(123,"Comprador de ejemplo",valid,token,DateTimeOffset.UtcNow);
if(System.Text.Encoding.ASCII.GetString(pdf,0,4)!="%PDF")throw new Exception("PDF inválido");
var encrypted=service.Cifrar(pdf);if(!service.Descifrar(encrypted).SequenceEqual(pdf))throw new Exception("Cifrado no reversible");
encrypted[^1]^=1;try{service.Descifrar(encrypted);throw new Exception("Aceptó contenido alterado");}catch(AuthenticationTagMismatchException){}
try{CredencialService.Imagen("invalid");throw new Exception("Aceptó foto inválida");}catch(InvalidOperationException){}
File.WriteAllBytes("/tmp/credencial-famkon-demo.pdf",pdf);
Console.WriteLine("PASS PDF, imagen, cifrado, integridad y rechazo de imagen inválida. No se enviaron mensajes ni se modificaron usuarios.");
using(var cache=new RegistroRostroService()) {
 var ticket=cache.Guardar(valid,valid);
 if(!cache.Obtener(ticket,Convert.ToBase64String(valid)).Segmentada.SequenceEqual(valid))throw new Exception("Referencia facial incorrecta");
 try{cache.Obtener("vencido",Convert.ToBase64String(valid));throw new Exception("Aceptó referencia ausente");}catch(InvalidOperationException){}
 var other=File.ReadAllBytes("Fronted/public/images/slogan-famkon.png");
 try{cache.Obtener(ticket,Convert.ToBase64String(other));throw new Exception("Aceptó foto sustituida");}catch(InvalidOperationException){}
 cache.Eliminar(ticket);
 try{cache.Obtener(ticket,Convert.ToBase64String(valid));throw new Exception("Aceptó referencia consumida");}catch(InvalidOperationException){}
}
foreach(var tema in new[]{"AZUL","NARANJA","MORADO"}) {
 var themed=CredencialPdf.Crear(123,"Comprador de ejemplo",valid,token,DateTimeOffset.UtcNow,tema);
 File.WriteAllBytes($"/tmp/credencial-{tema}.pdf",themed);
}
File.WriteAllText("/tmp/credencial-qr-esperado.txt",token);
Console.WriteLine("PASS referencia de segmentación ligada a captura, consumo y tres diseños.");
if(args.Contains("--oracle")) {
 var realConfig=new ConfigurationBuilder().AddJsonFile(Path.GetFullPath("Backend/FamKon_store_api/appsettings.json")).Build();
 var consultas=new CompraService(new FamKon_store_api.BD.DBContext(realConfig));
 var credencial=new CredencialService(consultas,realConfig,null!,null!);
 if(await credencial.Login(token) is not null)throw new Exception("QR ficticio aceptado");
 Console.WriteLine("PASS consulta real de login QR rechaza código ficticio; sin modificar cuentas.");
}
