-- Cambiar columnas FOTO_O y FOTO_E de CLOB a BLOB
-- IMPORTANTE: Ejecutar solo una vez. Las fotos existentes se perderan.

-- Paso 1: Agregar columnas BLOB temporales
ALTER TABLE USUARIOS ADD (foto_o_blob BLOB DEFAULT EMPTY_BLOB());
ALTER TABLE USUARIOS ADD (foto_e_blob BLOB DEFAULT EMPTY_BLOB());

-- Paso 2: Eliminar columnas CLOB antiguas
ALTER TABLE USUARIOS DROP COLUMN foto_o;
ALTER TABLE USUARIOS DROP COLUMN foto_e;

-- Paso 3: Renombrar columnas BLOB a los nombres originales
ALTER TABLE USUARIOS RENAME COLUMN foto_o_blob TO foto_o;
ALTER TABLE USUARIOS RENAME COLUMN foto_e_blob TO foto_e;

-- Verificar estructura
DESCRIBE USUARIOS;
