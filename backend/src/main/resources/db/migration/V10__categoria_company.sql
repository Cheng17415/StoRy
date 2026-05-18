UPDATE producto SET categoria_id = NULL WHERE categoria_id IS NOT NULL;

DELETE FROM categoria;

ALTER TABLE categoria
    ADD COLUMN company_id BIGINT REFERENCES company (id) ON DELETE CASCADE;

ALTER TABLE categoria
    ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX idx_categoria_company ON categoria (company_id);

CREATE UNIQUE INDEX idx_categoria_company_nombre ON categoria (company_id, nombre);
