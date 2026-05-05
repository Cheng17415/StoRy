CREATE TABLE company (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id BIGINT NOT NULL REFERENCES usuario (id),
    CONSTRAINT chk_company_currency CHECK (currency IN ('EUR', 'USD'))
);

CREATE TABLE company_member (
    company_id BIGINT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (company_id, user_id),
    CONSTRAINT uq_company_member_user UNIQUE (user_id),
    CONSTRAINT chk_company_member_role CHECK (role IN ('company_admin', 'employee', 'analytics_viewer'))
);

CREATE TABLE company_invitation (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES company (id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by_user_id BIGINT NOT NULL REFERENCES usuario (id),
    accepted_by_user_id BIGINT REFERENCES usuario (id),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_invitation_token UNIQUE (token_hash),
    CONSTRAINT chk_company_invitation_role CHECK (role IN ('company_admin', 'employee', 'analytics_viewer')),
    CONSTRAINT chk_company_invitation_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'))
);

CREATE INDEX idx_company_member_company ON company_member (company_id);
CREATE INDEX idx_company_invitation_company_email_status ON company_invitation (company_id, email, status);
CREATE INDEX idx_company_invitation_expires_at ON company_invitation (expires_at);

ALTER TABLE producto ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES company (id);

DO
$$
    DECLARE
        u RECORD;
        company_name_candidate VARCHAR(150);
        suffix INTEGER;
        company_id_created BIGINT;
    BEGIN
        FOR u IN (SELECT id, username FROM usuario ORDER BY id) LOOP
            company_name_candidate := 'company_' || regexp_replace(lower(u.username), '[^a-z0-9_]+', '_', 'g');
            company_name_candidate := trim(both '_' FROM company_name_candidate);
            IF company_name_candidate = '' THEN
                company_name_candidate := 'company_user_' || u.id;
            END IF;

            company_name_candidate := left(company_name_candidate, 130);
            suffix := 0;
            WHILE EXISTS (SELECT 1 FROM company c WHERE c.name = company_name_candidate) LOOP
                suffix := suffix + 1;
                company_name_candidate := left('company_user_' || u.id || '_' || suffix, 150);
            END LOOP;

            INSERT INTO company (name, password_hash, currency, created_by_user_id)
            VALUES (company_name_candidate, '$2a$10$7QJ6hW4Yf4JZ9V9J2V9v9eY5YxS4M3P7QbU6qJkQf8a9C2R0kW3rK', 'EUR', u.id)
            RETURNING id INTO company_id_created;

            INSERT INTO company_member (company_id, user_id, role)
            VALUES (company_id_created, u.id, 'company_admin');

            UPDATE producto
            SET company_id = company_id_created
            WHERE usuario_id = u.id
              AND company_id IS NULL;
        END LOOP;
    END
$$;

DO
$$
    BEGIN
        IF EXISTS (SELECT 1 FROM producto WHERE company_id IS NULL) THEN
            RAISE EXCEPTION 'No se pudo asignar company_id a todos los productos';
        END IF;
    END
$$;

ALTER TABLE producto ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE producto DROP CONSTRAINT IF EXISTS producto_codigo_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_producto_company_codigo ON producto (company_id, codigo);
CREATE INDEX IF NOT EXISTS idx_producto_company ON producto (company_id);

COMMENT ON TABLE company IS 'Empresas para agrupar usuarios y catálogo compartido.';
COMMENT ON TABLE company_member IS 'Miembros de empresa; cada usuario pertenece a una sola empresa.';
COMMENT ON TABLE company_invitation IS 'Invitaciones por correo con token hash y expiración.';
