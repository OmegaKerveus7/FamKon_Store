-- Ejecutar como TIENDA_APP.
-- Tamano real de impresion (cm) por producto: lo usa la ficha de preparacion
-- para imprimir los dos recuadros (Lado A / Lado B) al tamano exacto y recortar.
ALTER TABLE PRODUCTO ADD (
    ANCHO_CM NUMBER(5,2),
    ALTO_CM  NUMBER(5,2)
);

COMMENT ON COLUMN PRODUCTO.ANCHO_CM IS 'Ancho real (cm) del recuadro que se imprime y se recorta.';
COMMENT ON COLUMN PRODUCTO.ALTO_CM  IS 'Alto real (cm) del recuadro que se imprime y se recorta.';

-- Tarjeta NFC y anillos NFC: 8.5 x 5.5 cm (horizontal, igual que el diseno guardado).
UPDATE PRODUCTO SET ANCHO_CM = 8.50, ALTO_CM = 5.50 WHERE SKU IN ('TAR-NFC-01', 'ANI001');

-- Llaveros de acrilico personalizables (frente y atras, SIN NFC): 3.10 x 4.50 cm.
-- La foto del producto se carga despues desde el admin (ARCHIVO -> IMAGEN_PRODUCTO);
-- en la base de desarrollo quedo cargada desde Fronted/public/images/llaveros_de-acrilico.jpg.
INSERT INTO CATEGORIA_PRODUCTO (CODIGO, NOMBRE, DESCRIPCION, ACTIVO)
SELECT 'LLAVEROS', 'Llaveros de acrilico',
       'Llaveros de acrilico personalizables.', 'S'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM CATEGORIA_PRODUCTO WHERE CODIGO = 'LLAVEROS');

INSERT INTO PRODUCTO (ID_SITIO, ID_CATEGORIA, SKU, NOMBRE, DESCRIPCION, PRECIO_BASE,
                      PERMITE_LADO_A, PERMITE_LADO_B, ACTIVO, ANCHO_CM, ALTO_CM)
SELECT 1, C.ID_CATEGORIA, 'LLA-001', 'Llavero de acrilico personalizable',
       'Llavero de acrilico con tu imagen al frente y al reverso. Incluye anillo metalico. No incluye NFC.',
       20.00, 'S', 'S', 'S', 3.10, 4.50
  FROM CATEGORIA_PRODUCTO C
 WHERE C.CODIGO = 'LLAVEROS'
   AND NOT EXISTS (SELECT 1 FROM PRODUCTO WHERE SKU = 'LLA-001');

COMMIT;
