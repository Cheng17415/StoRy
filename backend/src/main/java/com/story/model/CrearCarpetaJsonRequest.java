package com.story.model;

import jakarta.validation.constraints.NotBlank;

public record CrearCarpetaJsonRequest(
        @NotBlank String nombre,
        String descripcion,
        Long parentId
) {
}
