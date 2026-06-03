ALTER TABLE producto
    ADD COLUMN codigo_barras VARCHAR(32),
    ADD COLUMN nutri_score VARCHAR(1),
    ADD COLUMN alergenos JSONB;

COMMENT ON COLUMN producto.codigo_barras IS 'EAN/GTIN opcional; puede repetirse entre productos de la misma empresa.';
COMMENT ON COLUMN producto.nutri_score IS 'Nutri-Score (a–e) desde Open Food Facts.';
COMMENT ON COLUMN producto.alergenos IS 'Tags de alérgenos OFF (p. ej. en:milk).';
