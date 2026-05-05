-- Cada producto pertenece a un usuario; solo ese usuario lo ve y lo gestiona.

ALTER TABLE producto ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuario (id);

CREATE INDEX IF NOT EXISTS idx_producto_usuario ON producto (usuario_id);

-- Reasignar productos existentes (sin dueño) al primer usuario, si hay alguno.
UPDATE producto p
SET usuario_id = (SELECT u.id FROM usuario u ORDER BY u.id ASC LIMIT 1)
WHERE p.usuario_id IS NULL
  AND EXISTS (SELECT 1 FROM usuario u);

COMMENT ON COLUMN producto.usuario_id IS 'Usuario propietario del producto.';

-- Solo forzar NOT NULL si no quedan filas huérfanas.
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM producto WHERE usuario_id IS NULL) THEN
            ALTER TABLE producto ALTER COLUMN usuario_id SET NOT NULL;
        END IF;
    END
$$;
