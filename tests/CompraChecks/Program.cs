using System.Security.Cryptography;
using System.Text;
using FamKon_store_api.Services;
var key=RandomNumberGenerator.GetBytes(32);var secret="whsec_"+Convert.ToBase64String(key);
var now=DateTimeOffset.UtcNow;var timestamp=now.ToUnixTimeSeconds().ToString();var id="msg_test";
var body=Encoding.UTF8.GetBytes("{\"event_type\":\"intent.succeeded\",\"amount_in_cents\":2500}");
string Sign(byte[] value)=>"v1,"+Convert.ToBase64String(HMACSHA256.HashData(key,Encoding.UTF8.GetBytes($"{id}.{timestamp}.").Concat(value).ToArray()));
void Assert(bool ok,string label){if(!ok)throw new Exception(label);Console.WriteLine("PASS "+label);}
Assert(RecurrenteService.FirmaValida(secret,id,timestamp,Sign(body),body,now),"firma válida");
Assert(!RecurrenteService.FirmaValida(secret,id,timestamp,Sign(body),Encoding.UTF8.GetBytes("{}"),now),"rechaza cuerpo alterado");
Assert(!RecurrenteService.FirmaValida(secret,id,timestamp,Sign(body),body,now.AddMinutes(6)),"rechaza replay fuera de ventana");
Assert(!RecurrenteService.FirmaValida(secret,"otro",timestamp,Sign(body),body,now),"rechaza identificador alterado");
Assert(!RecurrenteService.FirmaValida(secret,id,timestamp,"v1,no-base64",body,now),"rechaza firma malformada");
Assert(RecurrenteService.FirmaValida(secret,id,timestamp,"v1,no-base64 "+Sign(body),body,now),"acepta firma válida entre varias durante rotación");
