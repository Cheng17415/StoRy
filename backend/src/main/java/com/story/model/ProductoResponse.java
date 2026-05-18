package com.story.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

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
        List<CategoriaResponse> categorias,
        Long carpetaId,
        String carpetaNombre
) {
}
