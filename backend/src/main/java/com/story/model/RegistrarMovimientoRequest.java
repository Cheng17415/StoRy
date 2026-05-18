package com.story.model;

import jakarta.validation.constraints.NotNull;

public record RegistrarMovimientoRequest(
        @NotNull TipoMovimiento tipo,
        @NotNull Integer cantidad,
        String observacion
) {
}
