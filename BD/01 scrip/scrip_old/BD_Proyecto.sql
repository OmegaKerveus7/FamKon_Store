-- =====================================================
-- CREACIÓN DE TABLAS CON IDENTITY (GENERATED ALWAYS)
-- =====================================================

-- Tabla ROLES
CREATE TABLE roles (
    id_rol NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_rol VARCHAR2(60 CHAR) NOT NULL
);

-- Tabla MARCAS
CREATE TABLE marcas (
    id_marca NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_marca VARCHAR2(60 CHAR) NOT NULL
);

-- Tabla METODOS_PAGOS
CREATE TABLE metodos_pagos (
    id_metodo_pago NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    metodo_pago VARCHAR2(25 CHAR) NOT NULL
);

-- Tabla NIVELES
CREATE TABLE niveles (
    id_nivel NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_nivel VARCHAR2(10 CHAR) NOT NULL
);

-- Tabla EDIFICIOS
CREATE TABLE edificios (
    id_edificio NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_edificio VARCHAR2(60) NOT NULL
);

-- Tabla AULAS
CREATE TABLE aulas (
    id_aula NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_aula VARCHAR2(60 CHAR)
);

-- Tabla PRODUCTOS
CREATE TABLE productos (
    id_producto NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom_producto VARCHAR2(150 CHAR) NOT NULL,
    precio_comp NUMBER(6,2) NOT NULL,
    marcas_id_marca NUMBER NOT NULL,
    CONSTRAINT productos_marcas_FK FOREIGN KEY (marcas_id_marca) 
        REFERENCES marcas(id_marca) ON DELETE CASCADE
);

-- Tabla INVENTARIO
CREATE TABLE inventario (
    id_inventario NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto NUMBER NOT NULL,
    cantidad NUMBER NOT NULL,
    precio_venta NUMBER(6,2) NOT NULL,
    CONSTRAINT inventario_productos_FK FOREIGN KEY (id_producto) 
        REFERENCES productos(id_producto) ON DELETE CASCADE
);

-- Tabla RUTAS
CREATE TABLE rutas (
    id_ruta NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    edificios_id_edificio NUMBER NOT NULL,
    niveles_id_nivel NUMBER NOT NULL,
    aulas_id_aula NUMBER NOT NULL,
    niveles_id_nivel11 NUMBER NOT NULL,  -- Este nombre parece duplicado, revisar
    CONSTRAINT rutas_edificios_FK FOREIGN KEY (edificios_id_edificio) 
        REFERENCES edificios(id_edificio) ON DELETE CASCADE,
    CONSTRAINT rutas_niveles_FK FOREIGN KEY (niveles_id_nivel) 
        REFERENCES niveles(id_nivel) ON DELETE CASCADE,
    CONSTRAINT rutas_aulas_FK FOREIGN KEY (aulas_id_aula) 
        REFERENCES aulas(id_aula) ON DELETE CASCADE
);

-- Tabla USUARIOS (corregido el nombre)
CREATE TABLE usuarios (
    id_usuario NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    roles_id_rol NUMBER NOT NULL,
    codigo_qr CHAR(8 CHAR) NOT NULL,
    nombres VARCHAR2(120 CHAR) NOT NULL,
    apellidos VARCHAR2(120 CHAR) NOT NULL,
    correo VARCHAR2(100 CHAR) NOT NULL,
    contraseña VARCHAR2(200 CHAR) NOT NULL,
    foto_o CLOB NOT NULL,
    foto_e CLOB NOT NULL,
    fecha_nacaimiento DATE NOT NULL,  -- Tiene error ortográfico, debería ser fecha_nacimiento
    CONSTRAINT usuarios_roles_FK FOREIGN KEY (roles_id_rol) 
        REFERENCES roles(id_rol) ON DELETE CASCADE
);

-- Tabla HISTORIAL_VENTAS (corregido el nombre)
CREATE TABLE historial_ventas (
    id_historial_venta NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta NUMBER NOT NULL,
    fecha_venta DATE NOT NULL,
    descripcion VARCHAR2(250 CHAR)  -- Corregido: decripcion -> descripcion
);

-- Tabla VENTAS
CREATE TABLE ventas (
    id_venta NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto NUMBER NOT NULL,
    precio_final NUMBER(6,2) NOT NULL,
    cantidad NUMBER NOT NULL,
    usuario NUMBER NOT NULL,
    trabajador NUMBER NOT NULL,
    metodo_pago NUMBER NOT NULL,
    ubicacion NUMBER NOT NULL,
    CONSTRAINT ventas_productos_FK FOREIGN KEY (id_producto) 
        REFERENCES productos(id_producto),
    CONSTRAINT ventas_metodos_pagos_FK FOREIGN KEY (metodo_pago) 
        REFERENCES metodos_pagos(id_metodo_pago) ON DELETE CASCADE,
    CONSTRAINT ventas_usuarios_FK FOREIGN KEY (usuario) 
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT ventas_usuarios_FKv2 FOREIGN KEY (trabajador) 
        REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT ventas_rutas_FK FOREIGN KEY (ubicacion) 
        REFERENCES rutas(id_ruta) ON DELETE CASCADE,
    CONSTRAINT ventas_historial_ventas_FK FOREIGN KEY (id_venta) 
        REFERENCES historial_ventas(id_historial_venta) ON DELETE CASCADE
);


