package com.story.model;

import java.time.Instant;

public record MovimientoStockResponse(
        Long id,
        String tipo,
        Integer cantidad,
        Instant fecha,
        String observacion,
        String usuario
) {
}
