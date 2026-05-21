ALTER TABLE company DROP CONSTRAINT chk_company_currency;
ALTER TABLE company ADD CONSTRAINT chk_company_currency CHECK (currency IN ('EUR', 'USD', 'JPY', 'CNY'));
