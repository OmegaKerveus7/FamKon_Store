-- Ejecutar como TIENDA_APP.
-- Llavero NFC circular (ficha redonda de 4 cm) + precios del catalogo.
-- El alta del producto (imagen, precio y existencia) se hace desde el panel de
-- administracion; aqui solo se fijan las medidas de impresion, que el panel no
-- expone, y se dejan los precios al valor comercial vigente.
--
-- Medida de impresion del circular: 4 x 4 cm (se imprime sin borde: la imagen
-- ocupa todo el diametro de la ficha).
UPDATE PRODUCTO SET ANCHO_CM = 4, ALTO_CM = 4 WHERE SKU = 'LLA-NFC-CIRC';
/
-- Precios: tarjeta NFC 20, llaveros 15.
UPDATE PRODUCTO SET PRECIO_BASE = 20 WHERE SKU = 'TAR-NFC-01';
/
UPDATE PRODUCTO SET PRECIO_BASE = 15 WHERE SKU = 'LLA-001';
/
UPDATE PRODUCTO SET PRECIO_BASE = 15 WHERE SKU = 'LLA-NFC-CIRC';
/
COMMIT;
