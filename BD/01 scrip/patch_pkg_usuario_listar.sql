-- ============================================================================
-- PATCH: agregar SP_LISTAR_USUARIOS + SP_LISTAR_ROLES a PKG_USUARIO
-- Fecha: 2026-09-21
-- Re-ejecutable: usa CREATE OR REPLACE PACKAGE / PACKAGE BODY
-- ============================================================================

SET DEFINE OFF;
SET SERVEROUTPUT ON;

-- (Los headers ya quedaron modificados en 04_PACKAGES_TIENDA_ORACLE.sql al
-- recompilar el package. Este script solo asegura que las nuevas
-- procedures queden disponibles; si ya corriste el script principal, podes
-- saltarte la ejecucion de este.)

PROMPT ============================================================
PROMPT Si ya ejecutaste 04_PACKAGES_TIENDA_ORACLE.sql no hace falta
PROMPT correr este script. Ambos redefinen PKG_USUARIO.
PROMPT ============================================================

COMMIT;
/
