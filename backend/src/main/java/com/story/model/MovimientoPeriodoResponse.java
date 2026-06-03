package com.story.model;

import java.math.BigDecimal;
import java.time.Instant;

public record MovimientoPeriodoResponse(
        Long id,
        String tipo,
        Integer cantidad,
        Instant fecha,
        String observacion,
        String usuario,
        Long productoId,
        String productoNombre,
        String productoCodigo,
        String categorias,
        String carpetaNombre,
        BigDecimal valor
) {
}
