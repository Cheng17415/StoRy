-- Identidad de Google (sub) para cuentas LOCAL que vinculan Google; login por Google también resuelve por esta columna.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS google_provider_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_google_provider_id
    ON usuario (google_provider_id)
    WHERE google_provider_id IS NOT NULL;

COMMENT ON COLUMN usuario.google_provider_id IS 'Subject (sub) de Google para cuenta local vinculada; mutuamente excluyente con uso exclusivo de provider=GOOGLE + provider_id.';
