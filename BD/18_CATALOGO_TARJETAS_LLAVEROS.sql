-- Ejecutar como TIENDA_APP.
-- El catalogo queda solo con Tarjetas NFC y Llaveros de acrilico.
-- El anillo ANI001 no se vende: se desactiva (ACTIVO='N') para que no aparezca
-- en la tienda, pero NO se borra porque tiene historial en PEDIDO_DETALLE y
-- CARRITO_DETALLE (romperian las claves foraneas).
UPDATE PRODUCTO
   SET ACTIVO = 'N', FECHA_MODIFICACION = SYSTIMESTAMP
 WHERE SKU = 'ANI001';

-- La categoria (codigo ANILLOS) queda para las tarjetas NFC.
UPDATE CATEGORIA_PRODUCTO
   SET NOMBRE = 'Tarjetas NFC',
       DESCRIPCION = 'Tarjetas NFC personalizables.'
 WHERE CODIGO = 'ANILLOS';

COMMIT;
