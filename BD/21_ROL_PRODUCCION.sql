-- Ejecutar como TIENDA_APP.
-- Rol PRODUCCION: configura los productos (ABM, imagenes, precios, medidas) y
-- prepara las personalizaciones pendientes (impresion y marcado).
-- GESTIONAR_ENTREGAS es el permiso que exige hoy la worklist de preparacion;
-- se valida el ROL (no solo el permiso) porque REPARTIDOR tambien lo tiene.

INSERT INTO ROL (CODIGO, NOMBRE, DESCRIPCION, ACTIVO)
SELECT 'PRODUCCION', 'Produccion',
       'Configura los productos y prepara las personalizaciones pendientes.', 'S'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM ROL WHERE CODIGO = 'PRODUCCION');
/
INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT R.ID_ROL, P.ID_PERMISO
  FROM ROL R, PERMISO P
 WHERE R.CODIGO = 'PRODUCCION'
   AND P.CODIGO IN ('GESTIONAR_PRODUCTOS', 'GESTIONAR_ENTREGAS', 'GESTIONAR_PERFIL')
   AND NOT EXISTS (
       SELECT 1 FROM ROL_PERMISO RP
        WHERE RP.ID_ROL = R.ID_ROL AND RP.ID_PERMISO = P.ID_PERMISO);
/
COMMIT;
