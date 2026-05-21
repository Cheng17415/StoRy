CREATE TABLE perfil (
    id BIGSERIAL PRIMARY KEY,
    perfil VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    provider_id VARCHAR(255),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ultimo_login TIMESTAMPTZ
);

CREATE TABLE usuario_perfil (
    id_usuario BIGINT NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    id_perfil BIGINT NOT NULL REFERENCES perfil (id) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_perfil)
);

CREATE INDEX idx_usuario_perfil_perfil ON usuario_perfil (id_perfil);

CREATE TABLE categoria (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT
);

CREATE TABLE producto (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    codigo VARCHAR(255) NOT NULL UNIQUE,
    precio NUMERIC(12, 2),
    cantidad INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    imagen VARCHAR(1024),
    categoria_id BIGINT REFERENCES categoria (id)
);

CREATE INDEX idx_producto_categoria ON producto (categoria_id);

CREATE TABLE movimiento_stock (
    id BIGSERIAL PRIMARY KEY,
    producto_id BIGINT NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
    tipo VARCHAR(32) NOT NULL,
    cantidad INTEGER NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    observacion TEXT
);

CREATE INDEX idx_movimiento_producto ON movimiento_stock (producto_id);
CREATE INDEX idx_movimiento_usuario ON movimiento_stock (usuario_id);
