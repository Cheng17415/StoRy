package com.story.model;

import jakarta.validation.constraints.NotBlank;

public record CrearCarpetaJsonRequest(
        @NotBlank String nombre,
        String descripcion,
        Long parentId,
        /** Opcional: data URL ({@code data:image/png;base64,...}) o Base64 puro. */
        String imagenBase64
) {
}
