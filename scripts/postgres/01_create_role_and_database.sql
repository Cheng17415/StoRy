-- Crear rol y base de datos story (ejecutar como superusuario postgres).
-- Credenciales alineadas con backend/src/main/resources/application-dev.yml

SET client_encoding = 'UTF8';

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'story') THEN
            CREATE ROLE story WITH LOGIN PASSWORD 'story';
        END IF;
    END
$$;

SELECT format(
               'CREATE DATABASE %I OWNER %I ENCODING %L TEMPLATE template0',
               'story',
               'story',
               'UTF8'
       )
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'story')
\gexec
