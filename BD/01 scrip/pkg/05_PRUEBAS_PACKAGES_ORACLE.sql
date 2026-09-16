-- ============================================================================
-- PRUEBAS DE PACKAGES - ORACLE 21c
-- Ejecutar como TIENDA_APP en XEPDB1 con F5.
-- Solo realiza consultas; no modifica datos.
-- ============================================================================

SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- ============================================================
-- 1. ESTADO DE LOS PACKAGES
-- ============================================================

SELECT OBJECT_NAME, OBJECT_TYPE, STATUS
  FROM USER_OBJECTS
 WHERE OBJECT_NAME IN (
    'PKG_SEGURIDAD','PKG_ARCHIVO','PKG_CATALOGO',
    'PKG_CARRITO','PKG_PEDIDO','PKG_PAGO_ENTREGA'
 )
   AND OBJECT_TYPE IN ('PACKAGE','PACKAGE BODY')
 ORDER BY OBJECT_NAME, OBJECT_TYPE;

-- Deben aparecer 12 filas con estado VALID.

-- ============================================================
-- 2. ERRORES DE COMPILACION
-- ============================================================

SELECT NAME, TYPE, LINE, POSITION, TEXT
  FROM USER_ERRORS
 WHERE NAME IN (
    'PKG_SEGURIDAD','PKG_ARCHIVO','PKG_CATALOGO',
    'PKG_CARRITO','PKG_PEDIDO','PKG_PAGO_ENTREGA'
 )
 ORDER BY NAME, SEQUENCE;

-- La consulta anterior debe devolver 0 filas.

-- ============================================================
-- 3. PRUEBA DEL CATALOGO DE CATEGORIAS
-- ============================================================

VARIABLE RC_CATEGORIAS REFCURSOR;
BEGIN
    PKG_CATALOGO.SP_LISTAR_CATEGORIAS(
        P_SOLO_ACTIVAS => 'S',
        O_DATOS => :RC_CATEGORIAS
    );
END;
/
PRINT RC_CATEGORIAS;

-- Debe mostrar ANILLOS, LLAVEROS y TAZAS.

-- ============================================================
-- 4. PRUEBA DEL CATALOGO DE METODOS DE PAGO
-- ============================================================

VARIABLE RC_METODOS REFCURSOR;
BEGIN
    PKG_CATALOGO.SP_LISTAR_METODOS_PAGO(
        P_SOLO_ACTIVOS => 'S',
        O_DATOS => :RC_METODOS
    );
END;
/
PRINT RC_METODOS;

-- Debe mostrar EFECTIVO y TARJETA.

-- ============================================================
-- 5. VALIDACION FINAL
-- ============================================================

DECLARE
    V_VALIDOS NUMBER;
BEGIN
    SELECT COUNT(*) INTO V_VALIDOS
      FROM USER_OBJECTS
     WHERE OBJECT_NAME IN (
        'PKG_SEGURIDAD','PKG_ARCHIVO','PKG_CATALOGO',
        'PKG_CARRITO','PKG_PEDIDO','PKG_PAGO_ENTREGA'
     )
       AND OBJECT_TYPE IN ('PACKAGE','PACKAGE BODY')
       AND STATUS = 'VALID';

    DBMS_OUTPUT.PUT_LINE('Objetos VALID esperados: 12 / encontrados: ' || V_VALIDOS);
    IF V_VALIDOS <> 12 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Existen packages con errores.');
    END IF;
    DBMS_OUTPUT.PUT_LINE('Pruebas basicas finalizadas correctamente.');
END;
/
