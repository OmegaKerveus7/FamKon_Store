-- Ejecutar como TIENDA_APP.
-- El rol PRODUCCION queda a cargo de la preparacion de personalizaciones.
-- La configuracion del catalogo (ABM de productos, imagenes y precios) queda
-- en manos del SUPERVISOR y del ADMIN.

DELETE FROM ROL_PERMISO
 WHERE ID_ROL = (SELECT ID_ROL FROM ROL WHERE CODIGO = 'PRODUCCION')
   AND ID_PERMISO = (SELECT ID_PERMISO FROM PERMISO WHERE CODIGO = 'GESTIONAR_PRODUCTOS');
/
COMMIT;
