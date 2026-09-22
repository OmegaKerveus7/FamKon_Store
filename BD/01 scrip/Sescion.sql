create or replace NONEDITIONABLE PACKAGE PKG_LOGIN AS
    PROCEDURE CRUD(
        p_usuario_o_correo IN  VARCHAR2,
        p_nickname         IN  VARCHAR2,
        p_password         IN  VARCHAR2,
        p_token_qr         IN  VARCHAR2,
        p_id_archivo_foto  IN  NUMBER,
        p_opcion           IN  VARCHAR2,
        p_codigo_s         OUT NUMBER,
        p_mensaje          OUT NVARCHAR2,
        p_data             OUT NVARCHAR2
    );
END PKG_LOGIN;


create or replace NONEDITIONABLE PACKAGE BODY PKG_LOGIN AS

    V_NOMBRE_PAQUETE CONSTANT NVARCHAR2(100) := 'PKG_LOGIN';
    V_NOMBRE_PROC    CONSTANT NVARCHAR2(100) := 'CRUD';
    C_MAX_INTENTOS   CONSTANT NUMBER          := 5;

    -- =============================================================
    -- HASH_PASSWORD
    --   SHA-256 vía STANDARD_HASH (contexto SQL con SELECT INTO,
    --   porque STANDARD_HASH no es visible directamente en PL/SQL).
    --   >>> Si más adelante quieres salt + DBMS_CRYPTO, reemplaza
    --       solo esta función.
    -- =============================================================
    FUNCTION HASH_PASSWORD(
        p_password IN VARCHAR2
    ) RETURN VARCHAR2 IS
        v_hash VARCHAR2(64);
    BEGIN
        SELECT LOWER(STANDARD_HASH(p_password, 'SHA256'))
          INTO v_hash
          FROM dual;
        RETURN v_hash;
    END HASH_PASSWORD;

    -- =============================================================
    -- GET_USUARIO_JSON  (datos públicos + roles del usuario)
    -- =============================================================
    FUNCTION GET_USUARIO_JSON(
        p_id_usuario IN NUMBER
    ) RETURN CLOB IS
        v_json      CLOB;
        v_nickname  VARCHAR2(100);
        v_correo    VARCHAR2(200);
        v_telefono  VARCHAR2(50);
        v_fecha_nac DATE;
        v_activo    CHAR(1);
        v_bloqueado CHAR(1);
        v_roles     VARCHAR2(1000);
    BEGIN
        SELECT NICKNAME,
               CORREO,
               TELEFONO,
               FECHA_NACIMIENTO,
               ACTIVO,
               BLOQUEADO,
               (SELECT LISTAGG(R.CODIGO, ',') WITHIN GROUP (ORDER BY R.CODIGO)
                  FROM USUARIO_ROL UR
                  JOIN ROL R ON R.ID_ROL = UR.ID_ROL
                 WHERE UR.ID_USUARIO = U.ID_USUARIO
                   AND R.ACTIVO = 'S') AS ROLES
          INTO v_nickname,
               v_correo,
               v_telefono,
               v_fecha_nac,
               v_activo,
               v_bloqueado,
               v_roles
          FROM USUARIO U
         WHERE ID_USUARIO = p_id_usuario;

        v_json := '{'
            || '"id_usuario":'         || p_id_usuario
            || ',"nickname":"'         || v_nickname || '"'
            || ',"correo":"'           || v_correo   || '"'
            || ',"telefono":"'         || v_telefono || '"'
            || ',"fecha_nacimiento":"' || NVL(TO_CHAR(v_fecha_nac,'YYYY-MM-DD'),'') || '"'
            || ',"activo":"'           || v_activo    || '"'
            || ',"bloqueado":"'        || v_bloqueado || '"'
            || ',"roles":"'            || NVL(v_roles,'') || '"'
            || '}';

        RETURN v_json;

    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN '{"error":"Usuario no encontrado"}';
        WHEN OTHERS THEN
            RETURN '{"error":"' || REPLACE(SQLERRM,'"','''') || '"}';
    END GET_USUARIO_JSON;

    -- =============================================================
    -- Auditoría autónoma (no tumba el login si falla)
    -- =============================================================
    PROCEDURE REG_AUDITORIA(
        p_id_usuario    IN NUMBER,
        p_identificador IN VARCHAR2,
        p_metodo        IN VARCHAR2,
        p_resultado     IN CHAR,
        p_motivo        IN VARCHAR2
    ) IS
        PRAGMA AUTONOMOUS_TRANSACTION;
    BEGIN
        INSERT INTO BITACORA_ACCESO (
            ID_USUARIO, IDENTIFICADOR, METODO_ACCESO,
            RESULTADO, MOTIVO
        ) VALUES (
            p_id_usuario,
            SUBSTR(p_identificador, 1, 150),
            p_metodo,
            p_resultado,
            SUBSTR(p_motivo, 1, 300)
        );
        COMMIT;
    EXCEPTION
        WHEN OTHERS THEN ROLLBACK;
    END REG_AUDITORIA;

    -- =============================================================
    -- Login interno común (evita duplicar lógica en cada WHEN)
    -- =============================================================
    PROCEDURE LOGIN_INTERNO(
        p_id_usuario    IN  NUMBER,
        p_password      IN  VARCHAR2,   -- NULL si el método no lo requiere
        p_metodo        IN  VARCHAR2,   -- CONTRASENA | QR | FACIAL
        p_identificador IN  VARCHAR2,
        p_codigo_s      OUT NUMBER,
        p_mensaje       OUT NVARCHAR2,
        p_data          OUT NVARCHAR2
    ) IS
        v_password_hash VARCHAR2(255);
        v_bloqueado     CHAR(1);
        v_activo        CHAR(1);
        v_nickname      VARCHAR2(100);
    BEGIN
        SELECT PASSWORD_HASH, BLOQUEADO, ACTIVO, NICKNAME
          INTO v_password_hash, v_bloqueado, v_activo, v_nickname
          FROM USUARIO
         WHERE ID_USUARIO = p_id_usuario;

        -- Usuario inactivo
        IF v_activo = 'N' THEN
            p_codigo_s := 403;
            p_mensaje  := 'Usuario inactivo.';
            p_data     := NULL;
            REG_AUDITORIA(p_id_usuario, p_identificador, p_metodo, 'N', 'Usuario inactivo');
            RETURN;
        END IF;

        -- Usuario bloqueado
        IF v_bloqueado = 'S' THEN
            p_codigo_s := 403;
            p_mensaje  := 'Usuario bloqueado por intentos fallidos.';
            p_data     := NULL;
            REG_AUDITORIA(p_id_usuario, p_identificador, p_metodo, 'N', 'Usuario bloqueado');
            RETURN;
        END IF;

        -- Validación de contraseña solo cuando el método la requiere
        IF p_metodo = 'CONTRASENA' THEN
            IF HASH_PASSWORD(p_password) <> v_password_hash THEN
                UPDATE USUARIO
                   SET INTENTOS_FALLIDOS = INTENTOS_FALLIDOS + 1,
                       BLOQUEADO = CASE
                                     WHEN INTENTOS_FALLIDOS + 1 >= C_MAX_INTENTOS THEN 'S'
                                     ELSE BLOQUEADO
                                   END
                 WHERE ID_USUARIO = p_id_usuario;

                p_codigo_s := 401;
                p_mensaje  := 'Credenciales inválidas.';
                p_data     := NULL;
                REG_AUDITORIA(p_id_usuario, p_identificador, p_metodo, 'N', 'Password incorrecto');
                RETURN;
            END IF;
        END IF;

        -- Login OK
        UPDATE USUARIO
           SET INTENTOS_FALLIDOS = 0,
               ULTIMO_ACCESO     = SYSTIMESTAMP
         WHERE ID_USUARIO = p_id_usuario;

        p_codigo_s := 200;
        p_mensaje  := 'Login exitoso. Bienvenido ' || v_nickname;
        p_data     := GET_USUARIO_JSON(p_id_usuario);
        REG_AUDITORIA(p_id_usuario, p_identificador, p_metodo, 'S', 'Login OK');
    END LOGIN_INTERNO;

    -- =============================================================
    -- CRUD multifunción del login
    --   p_opcion = 'C'  ->  credenciales (correo/nickname/tel + password)
    --   p_opcion = 'N'  ->  nickname + password
    --   p_opcion = 'Q'  ->  token QR escaneado
    --   p_opcion = 'F'  ->  facial (correo/nickname + id selfie)
    -- =============================================================
    PROCEDURE CRUD(
        p_usuario_o_correo IN  VARCHAR2,
        p_nickname         IN  VARCHAR2,
        p_password         IN  VARCHAR2,
        p_token_qr         IN  VARCHAR2,
        p_id_archivo_foto  IN  NUMBER,
        p_opcion           IN  VARCHAR2,
        p_codigo_s         OUT NUMBER,
        p_mensaje          OUT NVARCHAR2,
        p_data             OUT NVARCHAR2
    ) AS
        V_ID NUMBER;
    BEGIN
        CASE UPPER(p_opcion)

            ---------------------------------------------------------
            -- C = Credenciales (correo / nickname / teléfono + password)
            ---------------------------------------------------------
            WHEN 'C' THEN
                IF p_usuario_o_correo IS NULL OR p_password IS NULL THEN
                    p_codigo_s := 400;
                    p_mensaje  := 'Usuario/correo y contraseña son obligatorios.';
                    p_data     := NULL;
                    RETURN;
                END IF;

                BEGIN
                    SELECT ID_USUARIO INTO V_ID
                      FROM USUARIO
                     WHERE UPPER(NICKNAME) = UPPER(p_usuario_o_correo)
                        OR UPPER(CORREO)   = UPPER(p_usuario_o_correo)
                        OR TELEFONO        = p_usuario_o_correo;
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_codigo_s := 404;
                        p_mensaje  := 'Usuario no encontrado.';
                        p_data     := NULL;
                        REG_AUDITORIA(NULL, p_usuario_o_correo, 'CONTRASENA', 'N', 'Usuario no encontrado');
                        RETURN;
                END;

                LOGIN_INTERNO(
                    V_ID, p_password, 'CONTRASENA',
                    p_usuario_o_correo,
                    p_codigo_s, p_mensaje, p_data
                );

            ---------------------------------------------------------
            -- N = Nickname + password
            ---------------------------------------------------------
            WHEN 'N' THEN
                IF p_nickname IS NULL OR p_password IS NULL THEN
                    p_codigo_s := 400;
                    p_mensaje  := 'Nickname y contraseña son obligatorios.';
                    p_data     := NULL;
                    RETURN;
                END IF;

                BEGIN
                    SELECT ID_USUARIO INTO V_ID
                      FROM USUARIO
                     WHERE UPPER(NICKNAME) = UPPER(p_nickname);
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_codigo_s := 404;
                        p_mensaje  := 'Nickname no encontrado.';
                        p_data     := NULL;
                        REG_AUDITORIA(NULL, p_nickname, 'CONTRASENA', 'N', 'Nickname no encontrado');
                        RETURN;
                END;

                LOGIN_INTERNO(
                    V_ID, p_password, 'CONTRASENA',
                    p_nickname,
                    p_codigo_s, p_mensaje, p_data
                );

            ---------------------------------------------------------
            -- Q = QR  (hashea el token escaneado y compara)
            ---------------------------------------------------------
            WHEN 'Q' THEN
                IF p_token_qr IS NULL THEN
                    p_codigo_s := 400;
                    p_mensaje  := 'Token QR es obligatorio.';
                    p_data     := NULL;
                    RETURN;
                END IF;

                BEGIN
                    SELECT ID_USUARIO INTO V_ID
                      FROM USUARIO
                     WHERE TOKEN_QR_HASH = LOWER(STANDARD_HASH(p_token_qr, 'SHA256'));
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_codigo_s := 404;
                        p_mensaje  := 'Token QR no válido.';
                        p_data     := NULL;
                        REG_AUDITORIA(NULL, p_token_qr, 'QR', 'N', 'QR no encontrado');
                        RETURN;
                END;

                LOGIN_INTERNO(
                    V_ID, NULL, 'QR',
                    p_token_qr,
                    p_codigo_s, p_mensaje, p_data
                );

            ---------------------------------------------------------
            -- F = Facial
            --   1) Ubica al usuario por correo/nickname.
            --   2) Compara el hash de la selfie entrante (ya subida
            --      a ARCHIVO) contra ID_FOTO_ORIGINAL / ID_FOTO_MODIFICADA.
            ---------------------------------------------------------
            WHEN 'F' THEN
                IF (p_usuario_o_correo IS NULL AND p_nickname IS NULL)
                   OR p_id_archivo_foto IS NULL THEN
                    p_codigo_s := 400;
                    p_mensaje  := 'Correo/nickname y selfie son obligatorios.';
                    p_data     := NULL;
                    RETURN;
                END IF;

                -- 1) Ubicar al usuario
                BEGIN
                    SELECT ID_USUARIO INTO V_ID
                      FROM USUARIO
                     WHERE (p_usuario_o_correo IS NOT NULL AND (
                               UPPER(CORREO)   = UPPER(p_usuario_o_correo)
                            OR UPPER(NICKNAME) = UPPER(p_usuario_o_correo)))
                        OR (p_nickname IS NOT NULL
                            AND UPPER(NICKNAME) = UPPER(p_nickname));
                EXCEPTION
                    WHEN NO_DATA_FOUND THEN
                        p_codigo_s := 404;
                        p_mensaje  := 'Usuario no encontrado para validación facial.';
                        p_data     := NULL;
                        REG_AUDITORIA(NULL, NVL(p_usuario_o_correo, p_nickname),
                                      'FACIAL', 'N', 'Usuario no encontrado');
                        RETURN;
                END;

                -- 2) Comparar hashes contra foto original o modificada
                DECLARE
                    v_hash_entrante VARCHAR2(64);
                    v_match         NUMBER := 0;
                BEGIN
                    SELECT HASH_SHA256 INTO v_hash_entrante
                      FROM ARCHIVO
                     WHERE ID_ARCHIVO = p_id_archivo_foto;

                    SELECT COUNT(*) INTO v_match
                      FROM USUARIO U
                     WHERE U.ID_USUARIO = V_ID
                       AND EXISTS (
                             SELECT 1
                               FROM ARCHIVO A
                              WHERE A.HASH_SHA256 = v_hash_entrante
                                AND A.ID_ARCHIVO IN (U.ID_FOTO_ORIGINAL,
                                                     U.ID_FOTO_MODIFICADA)
                           );

                    IF v_match = 0 THEN
                        p_codigo_s := 401;
                        p_mensaje  := 'La imagen no coincide con el rostro registrado.';
                        p_data     := NULL;
                        REG_AUDITORIA(V_ID, TO_CHAR(p_id_archivo_foto),
                                      'FACIAL', 'N', 'Rostro no coincide');
                        RETURN;
                    END IF;
                END;

                LOGIN_INTERNO(
                    V_ID, NULL, 'FACIAL',
                    TO_CHAR(p_id_archivo_foto),
                    p_codigo_s, p_mensaje, p_data
                );

            ELSE
                p_codigo_s := 400;
                p_mensaje  := 'Opción no válida: ' || p_opcion
                           || ' (use C, N, Q, F).';
                p_data     := NULL;
        END CASE;

    EXCEPTION
        WHEN TOO_MANY_ROWS THEN
            p_codigo_s := 400;
            p_mensaje  := 'Existen múltiples usuarios con ese identificador.';
            p_data     := NULL;
        WHEN OTHERS THEN
            p_codigo_s := 500;
            p_mensaje  := V_NOMBRE_PAQUETE || '.' || V_NOMBRE_PROC
                       || ' SQLCODE=' || SQLCODE || ' ' || SQLERRM;
            p_data     := NULL;
    END CRUD;

END PKG_LOGIN;