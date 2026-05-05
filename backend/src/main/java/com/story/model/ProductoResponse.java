package com.story.model;

import java.math.BigDecimal;
import java.time.Instant;

public record ProductoResponse(
        Long id,
        String nombre,
        String descripcion,
        String codigo,
        BigDecimal precio,
        Integer cantidad,
        Integer stockMinimo,
        boolean activo,
        Instant fechaCreacion,
        Instant fechaActualizacion,
        String imagen,
        Long categoriaId,
        String categoriaNombre
) {
}
