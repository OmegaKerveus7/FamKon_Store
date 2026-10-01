using System.Security.Cryptography;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using FamKon_store_api.Models.DTOs;
namespace FamKon_store_api.Services;
public class CredencialService(CompraService compras,IConfiguration config,EmailService email,WhatsAppService wa) {
 static OracleCommand Comando(OracleConnection c,string sql,params (string,object?)[] args) { var cmd=CompraService.Comando(c,sql,args);cmd.CommandTimeout=20;return cmd; }
 byte[] Key=>Convert.FromBase64String(config["Credencial:EncryptionKey"]??throw new InvalidOperationException("Configura la clave de cifrado de credenciales."));
 public byte[] Cifrar(byte[] plain){var nonce=RandomNumberGenerator.GetBytes(12);var cipher=new byte[plain.Length];var tag=new byte[16];using var aes=new AesGcm(Key,16);aes.Encrypt(nonce,plain,cipher,tag);return nonce.Concat(tag).Concat(cipher).ToArray();}
 public byte[] Descifrar(byte[] data){var plain=new byte[data.Length-28];using var aes=new AesGcm(Key,16);aes.Decrypt(data.AsSpan(0,12),data.AsSpan(28),data.AsSpan(12,16),plain);return plain;}
 public static byte[] Imagen(string input) {
  if(input.Length>3_000_000)throw new InvalidOperationException("La foto debe pesar menos de 2 MB.");
  byte[] bytes;try{bytes=Convert.FromBase64String(input.Contains(',')?input.Split(',',2)[1]:input);}catch{throw new InvalidOperationException("Foto no válida.");}
  if(bytes.Length<10 || bytes.Length>2_000_000 || !(bytes[0]==0xff&&bytes[1]==0xd8 || bytes[0]==137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71))throw new InvalidOperationException("Usa una foto JPG o PNG.");
  try { using var image=QuestPDF.Infrastructure.Image.FromBinaryData(bytes); } catch {throw new InvalidOperationException("No se pudo leer la fotografía.");}
  return bytes;
 }
 public async Task Emitir(long id,byte[]? foto=null,byte[]? original=null,byte[]? segmentada=null,string? tema=null) {
  using var c=await compras.Abrir(id);using var tx=c.BeginTransaction();
  using var user=Comando(c,"SELECT NICKNAME FROM USUARIO WHERE ID_USUARIO=:id AND ACTIVO='S' AND BLOQUEADO='N' FOR UPDATE WAIT 5",("id",id));
  user.CommandTimeout=15;
  var nick=await user.ExecuteScalarAsync() as string??throw new UnauthorizedAccessException();
  if(foto is null){using var get=Comando(c,"SELECT FOTO FROM CREDENCIAL WHERE ID_USUARIO=:id",("id",id));using var r=await get.ExecuteReaderAsync();if(!await r.ReadAsync())throw new InvalidOperationException("Primero personaliza una foto para tu credencial.");using var b=r.GetOracleBlob(0);foto=b.Value;}
  if(tema is null){using var theme=Comando(c,"SELECT TEMA FROM CREDENCIAL WHERE ID_USUARIO=:id",("id",id));tema=await theme.ExecuteScalarAsync() as string??"AZUL";}
  CredencialPdf.ColorTema(tema);
  var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();var version=Guid.NewGuid().ToString("N");
  var pdf=Cifrar(CredencialPdf.Crear(id,nick,foto,token,DateTimeOffset.UtcNow,tema));
  using var save=Comando(c,"MERGE INTO CREDENCIAL D USING (SELECT :id ID FROM DUAL) S ON (D.ID_USUARIO=S.ID) WHEN MATCHED THEN UPDATE SET FOTO=:foto,PDF_CIFRADO=:pdf,VERSION=:v,TEMA=:tema,EMITIDA=SYSTIMESTAMP WHEN NOT MATCHED THEN INSERT(ID_USUARIO,FOTO,PDF_CIFRADO,VERSION,TEMA) VALUES(:id,:foto,:pdf,:v,:tema)",("id",id),("v",version),("tema",tema));
  save.Parameters.Add("foto",OracleDbType.Blob).Value=foto;save.Parameters.Add("pdf",OracleDbType.Blob).Value=pdf;save.CommandTimeout=20;await save.ExecuteNonQueryAsync();
  using var update=Comando(c,"UPDATE USUARIO SET TOKEN_QR_HASH=:hash WHERE ID_USUARIO=:id",("hash",LoginService.Sha256LowerHex(token)),("id",id));update.CommandTimeout=15;await update.ExecuteNonQueryAsync();
  async Task<long> GuardarFoto(byte[] bytes,string tipo){
   using var archivo=Comando(c,"PKG_ARCHIVO.SP_GUARDAR_ARCHIVO");archivo.CommandType=System.Data.CommandType.StoredProcedure;
   archivo.Parameters.Add("P_ID_USUARIO_CARGA",OracleDbType.Int64).Value=id;
   archivo.Parameters.Add("P_TIPO_ARCHIVO",OracleDbType.Varchar2).Value=tipo;
   archivo.Parameters.Add("P_NOMBRE_ARCHIVO",OracleDbType.Varchar2).Value=$"{tipo}-{version}";
   archivo.Parameters.Add("P_MIME_TYPE",OracleDbType.Varchar2).Value=bytes[0]==137?"image/png":"image/jpeg";
   archivo.Parameters.Add("P_HASH_SHA256",OracleDbType.Varchar2).Value=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
   archivo.Parameters.Add("P_CONTENIDO",OracleDbType.Blob).Value=bytes;
   var output=archivo.Parameters.Add("O_ID_ARCHIVO",OracleDbType.Int64);output.Direction=System.Data.ParameterDirection.Output;
   await archivo.ExecuteNonQueryAsync();return ((OracleDecimal)output.Value).ToInt64();
  }
  using var originalActual=Comando(c,"SELECT ID_FOTO_ORIGINAL FROM USUARIO WHERE ID_USUARIO=:id",("id",id));
  var originalId=await originalActual.ExecuteScalarAsync();
  if(original is not null && (originalId is null || originalId is DBNull)){
   var originalGuardada=await GuardarFoto(original,"FOTO_USUARIO_ORIGINAL");
   long? rostroGuardado=segmentada is null?null:await GuardarFoto(segmentada,"FOTO_USUARIO_MODIFICADA");
   using var photo=Comando(c,"UPDATE USUARIO SET ID_FOTO_ORIGINAL=:foto,ID_FOTO_MODIFICADA=NVL(:rostro,ID_FOTO_MODIFICADA) WHERE ID_USUARIO=:id AND ID_FOTO_ORIGINAL IS NULL",("foto",originalGuardada),("rostro",rostroGuardado),("id",id));await photo.ExecuteNonQueryAsync();
  }
  await Encolar(c,id,version);tx.Commit();
 }
 static async Task Encolar(OracleConnection c,long id,string version){
  using var delete=Comando(c,"DELETE FROM CREDENCIAL_ENVIO WHERE ID_USUARIO=:id",("id",id));await delete.ExecuteNonQueryAsync();
  foreach(var canal in new[]{"EMAIL","WHATSAPP"}){var destino=canal=="EMAIL"?"CORREO":"TELEFONO";using var cmd=Comando(c,$"INSERT INTO CREDENCIAL_ENVIO(ID_USUARIO,CANAL,VERSION,DESTINO) SELECT ID_USUARIO,:canal,:v,{destino} FROM USUARIO WHERE ID_USUARIO=:id AND NOTIFICA_{canal}='S'",("canal",canal),("v",version),("id",id));await cmd.ExecuteNonQueryAsync();}
 }
 public async Task Reenviar(long id){using var c=await compras.Abrir(id);using var tx=c.BeginTransaction();using var u=Comando(c,"SELECT ID_USUARIO FROM USUARIO WHERE ID_USUARIO=:id FOR UPDATE WAIT 5",("id",id));await u.ExecuteScalarAsync();using var wait=Comando(c,"SELECT COUNT(*) FROM CREDENCIAL_ENVIO WHERE ID_USUARIO=:id AND (SOLICITADO>SYSTIMESTAMP-INTERVAL '10' MINUTE OR ESTADO='ENVIANDO')",("id",id));if(Convert.ToInt32(await wait.ExecuteScalarAsync())>0)throw new InvalidOperationException("Espera diez minutos antes de reenviar la credencial.");using var v=Comando(c,"SELECT VERSION FROM CREDENCIAL WHERE ID_USUARIO=:id",("id",id));var version=await v.ExecuteScalarAsync() as string??throw new KeyNotFoundException();await Encolar(c,id,version);tx.Commit();}
 public async Task<byte[]?> Leer(long id,bool foto=false){using var c=await compras.Abrir(id);using var cmd=Comando(c,$"SELECT {(foto?"FOTO":"PDF_CIFRADO")} FROM CREDENCIAL WHERE ID_USUARIO=:id",("id",id));using var r=await cmd.ExecuteReaderAsync();if(!await r.ReadAsync())return null;using var b=r.GetOracleBlob(0);return foto?b.Value:Descifrar(b.Value);}
 public async Task<LoginUsuarioData?> Login(string token){
  if(token.Length!=64||!token.All(char.IsAsciiHexDigit))return null;
  using var c=await compras.Abrir();using var cmd=Comando(c,"SELECT U.ID_USUARIO,U.NICKNAME,U.CORREO,U.TELEFONO,TO_CHAR(U.FECHA_NACIMIENTO,'YYYY-MM-DD') FECHA_NACIMIENTO,(SELECT LISTAGG(R.CODIGO,',') WITHIN GROUP(ORDER BY R.CODIGO) FROM USUARIO_ROL UR JOIN ROL R ON R.ID_ROL=UR.ID_ROL WHERE UR.ID_USUARIO=U.ID_USUARIO AND R.ACTIVO='S') ROLES FROM USUARIO U WHERE U.TOKEN_QR_HASH=:hash AND U.ACTIVO='S' AND U.BLOQUEADO='N'",("hash",LoginService.Sha256LowerHex(token)));
  var rows=await CompraService.Leer(cmd);var u=rows.FirstOrDefault();return u is null?null:new LoginUsuarioData{IdUsuario=Convert.ToInt64(u["idUsuario"]),Nickname=u["nickname"]?.ToString()??"",Correo=u["correo"]?.ToString()??"",Telefono=u["telefono"]?.ToString()??"",FechaNacimiento=u["fechaNacimiento"]?.ToString()??"",Roles=u["roles"]?.ToString()??""};
 }
 public async Task Procesar(){
  using var c=await compras.Abrir();using var list=Comando(c,"SELECT ID_USUARIO,CANAL,VERSION,DESTINO FROM CREDENCIAL_ENVIO WHERE ESTADO='PENDIENTE' FETCH FIRST 5 ROWS ONLY");var rows=await CompraService.Leer(list);
  foreach(var row in rows){var id=Convert.ToInt64(row["idUsuario"]);var canal=(string)row["canal"]!;var version=(string)row["version"]!;var api=config["Constancias:PublicApiUrl"];if(canal=="WHATSAPP"&&(!Uri.TryCreate(api,UriKind.Absolute,out var uri)||uri.Scheme!="https"))continue;
   var pdf=await Leer(id);if(pdf is null)continue;var token=Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
   using var claim=Comando(c,"UPDATE CREDENCIAL_ENVIO SET ESTADO='ENVIANDO',TOKEN=:t,EXPIRA=SYSTIMESTAMP+INTERVAL '10' MINUTE WHERE ID_USUARIO=:id AND CANAL=:canal AND VERSION=:v AND ESTADO='PENDIENTE'",("t",token),("id",id),("canal",canal),("v",version));if(await claim.ExecuteNonQueryAsync()!=1)continue;
   var ok=canal=="EMAIL"?await email.EnviarConstanciaAsync((string)row["destino"]!,id,pdf,true):await wa.EnviarConstanciaAsync((string)row["destino"]!,id,$"{api!.TrimEnd('/')}/api/famkon/credencial/documento/{token}",true);
   using var done=Comando(c,"UPDATE CREDENCIAL_ENVIO SET ESTADO=:s WHERE ID_USUARIO=:id AND CANAL=:c AND VERSION=:v",("s",ok?"ENVIADO":"ERROR"),("id",id),("c",canal),("v",version));await done.ExecuteNonQueryAsync();
  }
 }
 public async Task<byte[]?> Documento(string token){if(token.Length!=64||!token.All(char.IsAsciiHexDigit))return null;using var c=await compras.Abrir();using var cmd=Comando(c,"SELECT C.PDF_CIFRADO FROM CREDENCIAL C JOIN CREDENCIAL_ENVIO E ON E.ID_USUARIO=C.ID_USUARIO AND E.VERSION=C.VERSION WHERE E.TOKEN=:t AND E.EXPIRA>SYSTIMESTAMP",("t",token));using var r=await cmd.ExecuteReaderAsync();if(!await r.ReadAsync())return null;using var b=r.GetOracleBlob(0);return Descifrar(b.Value);}
}
