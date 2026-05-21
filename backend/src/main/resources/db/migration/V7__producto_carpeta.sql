CREATE TABLE producto_carpeta (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES producto_carpeta (id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_producto_carpeta_company ON producto_carpeta (company_id);
CREATE INDEX idx_producto_carpeta_company_parent ON producto_carpeta (company_id, parent_id);

ALTER TABLE producto
    ADD COLUMN carpeta_id BIGINT REFERENCES producto_carpeta (id) ON DELETE RESTRICT;

CREATE INDEX idx_producto_carpeta ON producto (carpeta_id);
