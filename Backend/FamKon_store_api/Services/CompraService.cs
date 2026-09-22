using System.Data;
using System.Globalization;
using FamKon_store_api.BD;
using FamKon_store_api.Models.Compras;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
namespace FamKon_store_api.Services;

public class CompraService(DBContext db) {
    public async Task<OracleConnection> Abrir(long? actor=null) {
        var c=db.CreateConnection();
        try { await db.OpenConnectionAsync(c); c.ClientId=actor?.ToString() ?? "RECURRENTE"; return c; }
        catch { c.Dispose(); throw; }
    }
    public static OracleCommand Comando(OracleConnection c,string sql,params (string,object?)[] args) {
        var cmd=new OracleCommand(sql,c) { BindByName=true };
        foreach(var (name,value) in args) cmd.Parameters.Add(new OracleParameter(name,value ?? DBNull.Value));
        return cmd;
    }
    public static async Task<List<Dictionary<string,object?>>> Leer(OracleCommand cmd) {
        var rows=new List<Dictionary<string,object?>>(); using var r=await cmd.ExecuteReaderAsync();
        while(await r.ReadAsync()) {
            var row=new Dictionary<string,object?>();
            for(var i=0;i<r.FieldCount;i++) {
                var parts=r.GetName(i).ToLowerInvariant().Split('_');
                var key=parts[0]+string.Concat(parts.Skip(1).Select(s=>char.ToUpperInvariant(s[0])+s[1..]));
                row[key]=r.IsDBNull(i)?null:r.GetValue(i);
            }
            rows.Add(row);
        }
        return rows;
    }
    public async Task<bool> EsAdmin(long actor) { using var c=await Abrir(actor); using var cmd=Comando(c,"SELECT PKG_COMPRA.ES_ADMIN(:actor) FROM DUAL",("actor",actor)); return Convert.ToInt32(await cmd.ExecuteScalarAsync())==1; }
    public async Task<bool> PuedeVer(long pedido,long actor,string vista) { using var c=await Abrir(actor); using var cmd=Comando(c,"SELECT PKG_COMPRA.PUEDE_VER(:pedido,:actor,:vista) FROM DUAL",("pedido",pedido),("actor",actor),("vista",vista)); return Convert.ToInt32(await cmd.ExecuteScalarAsync())==1; }
    public static readonly string ResumenSql="""
        SELECT P.ID_PEDIDO,P.ID_USUARIO,P.NUMERO_PEDIDO,P.ID_MODALIDAD_ENTREGA,P.SUBTOTAL,P.CARGO_ENTREGA,P.TOTAL,P.COD_MONEDA,
        P.TELEFONO_CONTACTO,P.TELEFONO_ALTERNO,P.DEPARTAMENTO,P.MUNICIPIO,P.DIRECCION_ENTREGA,P.REFERENCIA_ENTREGA,
        TO_CHAR(P.FECHA_PEDIDO,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA_PEDIDO,
        EP.CODIGO ESTADO,EP.NOMBRE ESTADO_NOMBRE,U.NICKNAME CLIENTE,
        MP.CODIGO METODO_PAGO,EG.CODIGO ESTADO_PAGO,PG.ENTORNO,PG.ID_PAGO,PG.ID_CHECKOUT_PROVEEDOR,
        (SELECT COUNT(*) FROM ENTREGA E JOIN ESTADO_ENTREGA EE ON EE.ID_ESTADO_ENTREGA=E.ID_ESTADO_ENTREGA WHERE E.ID_PEDIDO=P.ID_PEDIDO AND EE.CODIGO IN ('ASIGNADA','EN_RUTA')) ENTREGAS_ACTIVAS
        FROM PEDIDO P JOIN USUARIO U ON U.ID_USUARIO=P.ID_USUARIO
        JOIN ESTADO_PEDIDO EP ON EP.ID_ESTADO_PEDIDO=P.ID_ESTADO_PEDIDO
        LEFT JOIN PAGO PG ON PG.ID_PAGO=(SELECT MAX(PG2.ID_PAGO) FROM PAGO PG2 WHERE PG2.ID_PEDIDO=P.ID_PEDIDO)
        LEFT JOIN METODO_PAGO MP ON MP.ID_METODO_PAGO=PG.ID_METODO_PAGO
        LEFT JOIN ESTADO_PAGO EG ON EG.ID_ESTADO_PAGO=PG.ID_ESTADO_PAGO
        """;
    public async Task<object> Listar(long actor,string vista,int pagina,string? estado,string? busqueda) {
        pagina=Math.Max(1,pagina); using var c=await Abrir(actor);
        var filtro=" WHERE PKG_COMPRA.PUEDE_VER(P.ID_PEDIDO,:actor,:vista)=1 AND (:estado IS NULL OR EP.CODIGO=:estado) AND (:busqueda IS NULL OR UPPER(P.NUMERO_PEDIDO || ' ' || U.NICKNAME) LIKE '%' || UPPER(:busqueda) || '%')";
        var args=new (string,object?)[]{("actor",actor),("vista",vista),("estado",estado),("busqueda",busqueda)};
        using var count=Comando(c,"SELECT COUNT(*) FROM ("+ResumenSql+filtro+")",args);
        var total=Convert.ToInt32(await count.ExecuteScalarAsync());
        using var cmd=Comando(c,ResumenSql+filtro+" ORDER BY P.ID_PEDIDO DESC OFFSET :offset ROWS FETCH NEXT 20 ROWS ONLY",args.Concat(new[]{("offset",(object?)((pagina-1)*20))}).ToArray());
        return new { pedidos=await Leer(cmd),total,pagina,tamanoPagina=20 };
    }
    public async Task<Dictionary<string,object?>?> Resumen(long id,OracleConnection? connection=null) {
        var own=connection is null; var c=connection??await Abrir();
        try { using var cmd=Comando(c,ResumenSql+" WHERE P.ID_PEDIDO=:id",("id",id)); return (await Leer(cmd)).FirstOrDefault(); }
        finally { if(own)c.Dispose(); }
    }
    public async Task<object?> Detalle(long id,long actor,string vista) {
        if(!await PuedeVer(id,actor,vista)) return null;
        using var c=await Abrir(actor); var pedido=await Resumen(id,c);
        async Task<List<Dictionary<string,object?>>> Q(string sql) { using var cmd=Comando(c,sql,("id",id)); return await Leer(cmd); }
        var productos=await Q("SELECT ID_PRODUCTO,NOMBRE_PRODUCTO,SKU_PRODUCTO,CANTIDAD,PRECIO_UNITARIO,PRECIO_PERSONALIZA,SUBTOTAL FROM PEDIDO_DETALLE WHERE ID_PEDIDO=:id ORDER BY NUMERO_LINEA");
        var historial=await Q("""
          SELECT H.ID_HISTORIAL,E.CODIGO ESTADO,E.NOMBRE,H.COMENTARIO,
          TO_CHAR(H.FECHA_ESTADO,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA,U.NICKNAME ACTOR
          FROM PEDIDO_ESTADO_HISTORIAL H JOIN ESTADO_PEDIDO E ON E.ID_ESTADO_PEDIDO=H.ID_ESTADO_PEDIDO
          LEFT JOIN USUARIO U ON U.ID_USUARIO=H.ID_USUARIO_ACTOR WHERE H.ID_PEDIDO=:id ORDER BY H.FECHA_ESTADO DESC,H.ID_HISTORIAL DESC
          """);
        var entregas=await Q("""
          SELECT E.ID_ENTREGA,E.ID_REPARTIDOR,U.NICKNAME REPARTIDOR,E.NUMERO_INTENTO,EE.CODIGO ESTADO,E.NOMBRE_RECEPTOR,E.ID_ARCHIVO_EVIDENCIA,E.MONTO_EFECTIVO,E.OBSERVACIONES,
          TO_CHAR(E.FECHA_ASIGNACION,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA_ASIGNACION,
          TO_CHAR(E.FECHA_INTENTO,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA_INTENTO,
          TO_CHAR(E.FECHA_ENTREGA,'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM') FECHA_ENTREGA
          FROM ENTREGA E JOIN ESTADO_ENTREGA EE ON EE.ID_ESTADO_ENTREGA=E.ID_ESTADO_ENTREGA LEFT JOIN USUARIO U ON U.ID_USUARIO=E.ID_REPARTIDOR WHERE E.ID_PEDIDO=:id ORDER BY E.NUMERO_INTENTO DESC
          """);
        var auditoria=vista=="admin"?await Q("SELECT A.MOTIVO,U.NICKNAME ACTOR,TO_CHAR(A.FECHA,'YYYY-MM-DD\"T\"HH24:MI:SS.FF3TZH:TZM') FECHA FROM PEDIDO_DATO_HISTORIAL A JOIN USUARIO U ON U.ID_USUARIO=A.ID_USUARIO_ACTOR WHERE A.ID_PEDIDO=:id ORDER BY A.ID_CAMBIO DESC"):new();
        return new {pedido,productos,historial,entregas,auditoria};
    }
    public async Task<long> Ejecutar(long actor,string procedimiento,params (string,object?)[] args) {
        using var c=await Abrir(actor); using var tx=c.BeginTransaction();
        try {
            using var cmd=Comando(c,"PKG_COMPRA."+procedimiento,args); cmd.CommandType=CommandType.StoredProcedure;
            OracleParameter? output=null;
            if(procedimiento=="CREAR") { output=new("O_PEDIDO",OracleDbType.Int64){Direction=ParameterDirection.Output};cmd.Parameters.Add(output); }
            await cmd.ExecuteNonQueryAsync(); var id=output is null?0:((OracleDecimal)output.Value).ToInt64(); tx.Commit(); return id;
        } catch {tx.Rollback();throw;}
    }
    public Task<long> Crear(long actor,CrearCompraRequest r,string entorno)=>Ejecutar(actor,"CREAR",("P_ACTOR",actor),("P_CARRITO",r.IdCarrito),("P_MODALIDAD",r.IdModalidadEntrega),("P_TELEFONO",r.TelefonoContacto),("P_ALTERNO",r.TelefonoAlterno),("P_DEPARTAMENTO",r.Departamento),("P_MUNICIPIO",r.Municipio),("P_DIRECCION",r.DireccionEntrega),("P_REFERENCIA",r.ReferenciaEntrega),("P_METODO",r.MetodoPago),("P_ENTORNO",entorno));
    public async Task<object> Repartidores(long actor) {
        using var c=await Abrir(actor); using var cmd=Comando(c,"SELECT DISTINCT U.ID_USUARIO,U.NICKNAME FROM USUARIO U JOIN USUARIO_ROL UR ON UR.ID_USUARIO=U.ID_USUARIO JOIN ROL R ON R.ID_ROL=UR.ID_ROL WHERE U.ACTIVO='S' AND U.BLOQUEADO='N' AND R.CODIGO='REPARTIDOR' AND R.ACTIVO='S' ORDER BY U.NICKNAME");return await Leer(cmd);
    }
    public async Task<bool> PuedeArchivo(long archivo,long actor) {
        using var c=await Abrir(actor);
        using var cmd=Comando(c,"""
         SELECT COUNT(*) FROM ARCHIVO A WHERE A.ID_ARCHIVO=:archivo AND A.ACTIVO='S' AND
         (A.ID_USUARIO_CARGA=:actor OR PKG_COMPRA.ES_ADMIN(:actor)=1 OR
          A.TIPO_ARCHIVO='IMAGEN_PRODUCTO' OR EXISTS(SELECT 1 FROM ENTREGA E JOIN PEDIDO P ON P.ID_PEDIDO=E.ID_PEDIDO WHERE E.ID_ARCHIVO_EVIDENCIA=A.ID_ARCHIVO AND (P.ID_USUARIO=:actor OR E.ID_REPARTIDOR=:actor)))
         """,("archivo",archivo),("actor",actor));return Convert.ToInt32(await cmd.ExecuteScalarAsync())>0;
    }
}
