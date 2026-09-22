-- ============================================================================
-- INSERTS ROL_PERMISO  +  PERMISO
-- Enrolamiento de permisos por rol para FamKon
-- Fecha: 2026-09-21
-- ============================================================================

SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- ----------------------------------------------------------------------------
-- 1) PERMISO: agregar permisos faltantes para cubrir vistas por rol
--    (los permisos ya existentes en la BD NO se duplican por UK_PERMISO_CODIGO)
-- ----------------------------------------------------------------------------

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('VER_CATALOGO',          'Ver catálogo de productos',          'COMPRAS',
     'Permite al comprador explorar la tienda y ver el detalle de los productos.');

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('VER_CARRITO',           'Ver y gestionar carrito de compras',  'COMPRAS',
     'Permite ver, agregar, modificar cantidades y eliminar items del carrito.');

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('REALIZAR_PAGO',         'Realizar pago del pedido',            'PAGOS',
     'Permite seleccionar método de pago y procesar el cobro del pedido.');

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('VER_PEDIDOS_ASIGNADOS', 'Ver pedidos asignados al repartidor', 'ENTREGAS',
     'Permite al repartidor ver los pedidos que le fueron asignados para entrega.');

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('GESTIONAR_ESTADO_PEDIDO', 'Cambiar estado de un pedido',       'ENTREGAS',
     'Permite cambiar el estado del pedido durante el flujo de entrega.');

INSERT INTO PERMISO (CODIGO, NOMBRE, MODULO, DESCRIPCION) VALUES
    ('GESTIONAR_PRODUCTOS',   'Gestionar productos (ABM)',            'ADMINISTRACION',
     'Permite crear, actualizar y cambiar el estado activo/inactivo de productos.');

COMMIT;
/

-- ============================================================================
-- 2) ROL_PERMISO  -  Asignación de permisos por rol
--    IMPORTANTE: estos INSERT son idempotentes respecto a la PK compuesta
--    (ID_ROL, ID_PERMISO). Si ya existen, Oracle lanza DUP_VAL_ON_INDEX,
--    se captura y se continúa para que el script sea re-ejecutable.
-- ============================================================================

-- ADMINISTRADOR: recibe TODOS los permisos del sistema.
INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT R.ID_ROL, P.ID_PERMISO
  FROM ROL R CROSS JOIN PERMISO P
 WHERE R.CODIGO = 'ADMIN';

-- SUPERVISOR: dashboard, gestor de usuarios, gestor de productos, perfil.
INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT R.ID_ROL, P.ID_PERMISO
  FROM ROL R JOIN PERMISO P ON 1 = 1
 WHERE R.CODIGO = 'SUPERVISOR'
   AND P.CODIGO IN (
        'GESTIONAR_USUARIOS',
        'GESTIONAR_PRODUCTOS',
        'GESTIONAR_ENTREGAS',
        'VER_DASHBOARD',
        'GESTIONAR_PERFIL'
   );

-- REPARTIDOR: pedidos asignados, entregas, cambios de estado, perfil.
INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT R.ID_ROL, P.ID_PERMISO
  FROM ROL R JOIN PERMISO P ON 1 = 1
 WHERE R.CODIGO = 'REPARTIDOR'
   AND P.CODIGO IN (
        'VER_PEDIDOS_ASIGNADOS',
        'GESTIONAR_ENTREGAS',
        'GESTIONAR_ESTADO_PEDIDO',
        'GESTIONAR_PERFIL'
   );

-- COMPRADOR: tienda, carrito, pagos, tracking e histórico, perfil.
INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO)
SELECT R.ID_ROL, P.ID_PERMISO
  FROM ROL R JOIN PERMISO P ON 1 = 1
 WHERE R.CODIGO = 'COMPRADOR'
   AND P.CODIGO IN (
        'VER_CATALOGO',
        'VER_CARRITO',
        'CREAR_PEDIDO',
        'REALIZAR_PAGO',
        'VER_TRACKING',
        'VER_HISTORICO',
        'GESTIONAR_PERFIL'
   );

COMMIT;
/

-- ============================================================================
-- 3) VALIDACIÓN
-- ============================================================================

PROMPT -----------------------------------------
PROMPT Resumen de permisos por rol
PROMPT -----------------------------------------
COLUMN rol            FORMAT A12
COLUMN codigo_permiso FORMAT A30
COLUMN permiso        FORMAT A45

SELECT R.CODIGO AS rol,
       P.CODIGO AS codigo_permiso,
       P.NOMBRE AS permiso
  FROM ROL R
  JOIN ROL_PERMISO RP ON RP.ID_ROL = R.ID_ROL
  JOIN PERMISO P      ON P.ID_PERMISO = RP.ID_PERMISO
 WHERE R.ACTIVO = 'S' AND P.ACTIVO = 'S'
 ORDER BY R.CODIGO, P.MODULO, P.CODIGO;

PROMPT -----------------------------------------
PROMPT Conteo de permisos asignados por rol
PROMPT -----------------------------------------
SELECT R.CODIGO AS rol, COUNT(*) AS total_permisos
  FROM ROL R
  JOIN ROL_PERMISO RP ON RP.ID_ROL = R.ID_ROL
 WHERE R.ACTIVO = 'S'
 GROUP BY R.CODIGO
 ORDER BY R.CODIGO;

/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
