DROP PACKAGE PKG_LOGIN;
/

-- =============================================
-- PACKAGE SPECIFICATION
-- =============================================
CREATE OR REPLACE PACKAGE PKG_LOGIN AS

    PROCEDURE LOGIN_BY_CREDENTIALS(
        p_usuario_o_correo  VARCHAR2,
        p_contraseña        VARCHAR2,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    );

    PROCEDURE LOGIN_BY_QR(
        p_codigo_qr         CHAR,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    );

    PROCEDURE LOGIN_BY_FACE(
        p_foto_a_comparar   CLOB,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    );

    PROCEDURE LOGIN_BY_NICKNAME(
        p_nickname          VARCHAR2,
        p_contraseña        VARCHAR2,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    );

END PKG_LOGIN;
/

-- =============================================
-- PACKAGE BODY
-- =============================================
CREATE OR REPLACE PACKAGE BODY PKG_LOGIN AS

    vnombre_paquete NVARCHAR2(100) := 'PKG_LOGIN';

    FUNCTION GET_USUARIO_JSON(
        p_id_usuario NUMBER
    ) RETURN CLOB IS
        v_json CLOB;
        v_nickname VARCHAR2(120);
        v_nombres VARCHAR2(120);
        v_apellidos VARCHAR2(120);
        v_correo VARCHAR2(100);
        v_codigo_qr CHAR(8);
        v_role NUMBER;
        v_fecha DATE;
    BEGIN
        SELECT
            NICKNAME,
            NOMBRES,
            APELLIDOS,
            CORREO,
            CODIGO_QR,
            ROLE,
            FECHA_NACAIMIENTO
        INTO
            v_nickname,
            v_nombres,
            v_apellidos,
            v_correo,
            v_codigo_qr,
            v_role,
            v_fecha
        FROM USUARIOS
        WHERE ID_USUARIO = p_id_usuario;

        v_json := '{"id_usuario":' || p_id_usuario ||
                  ',"role":' || v_role ||
                  ',"nickname":"' || v_nickname || '"' ||
                  ',"codigo_qr":"' || v_codigo_qr || '"' ||
                  ',"nombres":"' || v_nombres || '"' ||
                  ',"apellidos":"' || v_apellidos || '"' ||
                  ',"correo":"' || v_correo || '"' ||
                  ',"fecha_nacimiento":"' || TO_CHAR(v_fecha, 'YYYY-MM-DD') || '"' ||
                  '}';

        RETURN v_json;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN '{"error":"Usuario no encontrado"}';
        WHEN OTHERS THEN
            RETURN '{"error":"' || SQLERRM || '"}';
    END GET_USUARIO_JSON;

    FUNCTION USUARIO_EXISTE(
        p_id_usuario NUMBER
    ) RETURN BOOLEAN IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count
        FROM USUARIOS
        WHERE ID_USUARIO = p_id_usuario;

        RETURN v_count > 0;
    END USUARIO_EXISTE;

    -- =============================================
    -- PROCEDIMIENTO 1: LOGIN POR CREDENCIALES
    -- =============================================
    PROCEDURE LOGIN_BY_CREDENTIALS(
        p_usuario_o_correo  VARCHAR2,
        p_contraseña        VARCHAR2,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    ) IS
        v_id_usuario NUMBER;
        v_nickname VARCHAR2(120);
        v_nombre_completo VARCHAR2(240);
        v_correo_usuario VARCHAR2(100);
        v_contraseña_db VARCHAR2(200);
        v_json CLOB;
        v_proc_name VARCHAR2(100) := 'LOGIN_BY_CREDENTIALS';
    BEGIN
        SELECT
            ID_USUARIO,
            NICKNAME,
            NOMBRES || ' ' || APELLIDOS AS NOMBRE_COMPLETO,
            CORREO,
            CONTRASEÑA
        INTO
            v_id_usuario,
            v_nickname,
            v_nombre_completo,
            v_correo_usuario,
            v_contraseña_db
        FROM USUARIOS
        WHERE UPPER(NOMBRES) = UPPER(p_usuario_o_correo)
           OR UPPER(APELLIDOS) = UPPER(p_usuario_o_correo)
           OR UPPER(CORREO) = UPPER(p_usuario_o_correo)
           OR UPPER(NICKNAME) = UPPER(p_usuario_o_correo);

        IF p_contraseña = v_contraseña_db THEN
            v_json := GET_USUARIO_JSON(v_id_usuario);

            p_codigo_s := 200;
            p_mensaje := 'Login exitoso. Bienvenido ' || v_nickname || ' (' || v_nombre_completo || ')';
            p_data := v_json;
        ELSE
            p_codigo_s := 401;
            p_mensaje := 'Contraseña incorrecta.';
            p_data := NULL;
        END IF;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_codigo_s := 404;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. Usuario, nickname o correo no encontrado: ' || p_usuario_o_correo;
            p_data := NULL;
        WHEN TOO_MANY_ROWS THEN
            p_codigo_s := 400;
            p_mensaje := 'Múltiples usuarios encontrados con ese nombre/nickname/correo.';
            p_data := NULL;
        WHEN OTHERS THEN
            p_codigo_s := 500;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. SQLCODE: ' || TO_CHAR(SQLCODE) || ' / ERROR: ' || SQLERRM;
            p_data := NULL;
    END LOGIN_BY_CREDENTIALS;

    -- =============================================
    -- PROCEDIMIENTO 2: LOGIN POR CÓDIGO QR
    -- =============================================
    PROCEDURE LOGIN_BY_QR(
        p_codigo_qr         CHAR,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    ) IS
        v_id_usuario NUMBER;
        v_nickname VARCHAR2(120);
        v_nombre_completo VARCHAR2(240);
        v_json CLOB;
        v_proc_name VARCHAR2(100) := 'LOGIN_BY_QR';
    BEGIN
        SELECT
            ID_USUARIO,
            NICKNAME,
            NOMBRES || ' ' || APELLIDOS AS NOMBRE_COMPLETO
        INTO
            v_id_usuario,
            v_nickname,
            v_nombre_completo
        FROM USUARIOS
        WHERE CODIGO_QR = p_codigo_qr;

        v_json := GET_USUARIO_JSON(v_id_usuario);

        p_codigo_s := 200;
        p_mensaje := 'Login por QR exitoso. Bienvenido ' || v_nickname || ' (' || v_nombre_completo || ')';
        p_data := v_json;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_codigo_s := 404;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. Código QR no encontrado: ' || p_codigo_qr;
            p_data := NULL;
        WHEN OTHERS THEN
            p_codigo_s := 500;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. SQLCODE: ' || TO_CHAR(SQLCODE) || ' / ERROR: ' || SQLERRM;
            p_data := NULL;
    END LOGIN_BY_QR;

    -- =============================================
    -- PROCEDIMIENTO 3: LOGIN POR NICKNAME
    -- =============================================
    PROCEDURE LOGIN_BY_NICKNAME(
        p_nickname          VARCHAR2,
        p_contraseña        VARCHAR2,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    ) IS
        v_id_usuario NUMBER;
        v_nickname_db VARCHAR2(120);
        v_nombre_completo VARCHAR2(240);
        v_contraseña_db VARCHAR2(200);
        v_json CLOB;
        v_proc_name VARCHAR2(100) := 'LOGIN_BY_NICKNAME';
    BEGIN
        SELECT
            ID_USUARIO,
            NICKNAME,
            NOMBRES || ' ' || APELLIDOS AS NOMBRE_COMPLETO,
            CONTRASEÑA
        INTO
            v_id_usuario,
            v_nickname_db,
            v_nombre_completo,
            v_contraseña_db
        FROM USUARIOS
        WHERE UPPER(NICKNAME) = UPPER(p_nickname);

        IF p_contraseña = v_contraseña_db THEN
            v_json := GET_USUARIO_JSON(v_id_usuario);

            p_codigo_s := 200;
            p_mensaje := 'Login por nickname exitoso. Bienvenido ' || v_nickname_db;
            p_data := v_json;
        ELSE
            p_codigo_s := 401;
            p_mensaje := 'Contraseña incorrecta.';
            p_data := NULL;
        END IF;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            p_codigo_s := 404;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. Nickname no encontrado: ' || p_nickname;
            p_data := NULL;
        WHEN OTHERS THEN
            p_codigo_s := 500;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. SQLCODE: ' || TO_CHAR(SQLCODE) || ' / ERROR: ' || SQLERRM;
            p_data := NULL;
    END LOGIN_BY_NICKNAME;

    -- =============================================
    -- PROCEDIMIENTO 4: LOGIN POR RECONOCIMIENTO FACIAL
    -- =============================================
    PROCEDURE LOGIN_BY_FACE(
        p_foto_a_comparar   CLOB,
        p_codigo_s OUT NUMBER,
        p_mensaje OUT NVARCHAR2,
        p_data OUT NVARCHAR2
    ) IS
        v_id_usuario NUMBER;
        v_nickname VARCHAR2(120);
        v_nombre_completo VARCHAR2(240);
        v_json CLOB;
        v_proc_name VARCHAR2(100) := 'LOGIN_BY_FACE';
    BEGIN
        BEGIN
            SELECT
                ID_USUARIO,
                NICKNAME,
                NOMBRES || ' ' || APELLIDOS AS NOMBRE_COMPLETO
            INTO
                v_id_usuario,
                v_nickname,
                v_nombre_completo
            FROM USUARIOS
            WHERE DBMS_LOB.COMPARE(FOTO_O, p_foto_a_comparar) = 0
            AND ROWNUM = 1;

            v_json := GET_USUARIO_JSON(v_id_usuario);

            p_codigo_s := 200;
            p_mensaje := 'Login facial exitoso (foto original). Bienvenido ' || v_nickname;
            p_data := v_json;

        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                BEGIN
                    SELECT
                        ID_USUARIO,
                        NICKNAME,
                        NOMBRES || ' ' || APELLIDOS AS NOMBRE_COMPLETO
                    INTO
                        v_id_usuario,
                        v_nickname,
                        v_nombre_completo
                    FROM USUARIOS
                    WHERE DBMS_LOB.COMPARE(FOTO_E, p_foto_a_comparar) = 0
                    AND ROWNUM = 1;

                    v_json := GET_USUARIO_JSON(v_id_usuario);

                    p_codigo_s := 200;
                    p_mensaje := 'Login facial exitoso (foto editada). Bienvenido ' || v_nickname;
                    p_data := v_json;

                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_codigo_s := 404;
                        p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                                    '. No se encontró un usuario con esa imagen facial.';
                        p_data := NULL;
                    WHEN OTHERS THEN
                        RAISE;
                END;
            WHEN OTHERS THEN
                RAISE;
        END;

    EXCEPTION
        WHEN OTHERS THEN
            p_codigo_s := 500;
            p_mensaje := vnombre_paquete || '.' || v_proc_name ||
                        '. SQLCODE: ' || TO_CHAR(SQLCODE) || ' / ERROR: ' || SQLERRM;
            p_data := NULL;
    END LOGIN_BY_FACE;

END PKG_LOGIN;
/
