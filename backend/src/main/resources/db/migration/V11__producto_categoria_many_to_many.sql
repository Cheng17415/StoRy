CREATE TABLE producto_categoria (
    producto_id BIGINT NOT NULL REFERENCES producto (id) ON DELETE CASCADE,
    categoria_id BIGINT NOT NULL REFERENCES categoria (id) ON DELETE CASCADE,
    PRIMARY KEY (producto_id, categoria_id)
);

CREATE INDEX idx_producto_categoria_categoria ON producto_categoria (categoria_id);

INSERT INTO producto_categoria (producto_id, categoria_id)
SELECT id, categoria_id
FROM producto
WHERE categoria_id IS NOT NULL;

ALTER TABLE producto DROP COLUMN categoria_id;

DROP INDEX IF EXISTS idx_producto_categoria;
