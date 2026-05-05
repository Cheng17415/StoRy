-- Historial de stock por producto (entradas/salidas); los registros se crean al dar de alta o al cambiar cantidad.

COMMENT ON TABLE movimiento_stock IS 'Movimientos de inventario: cada fila es una entrada o salida de unidades con fecha y usuario.';
COMMENT ON COLUMN movimiento_stock.tipo IS 'ENTRADA, SALIDA o AJUSTE (valores del enum en aplicación).';
COMMENT ON COLUMN movimiento_stock.cantidad IS 'Unidades del movimiento (siempre positivas).';
COMMENT ON COLUMN movimiento_stock.fecha IS 'Instante del movimiento.';
COMMENT ON COLUMN movimiento_stock.observacion IS 'Nota opcional (p. ej. Stock inicial).';
