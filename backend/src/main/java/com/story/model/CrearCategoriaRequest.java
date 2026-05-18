package com.story.model;

import jakarta.validation.constraints.NotBlank;

public record CrearCategoriaRequest(
        @NotBlank String nombre,
        String descripcion
) {
}
