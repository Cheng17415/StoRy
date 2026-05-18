package com.story.model;

import jakarta.validation.constraints.NotBlank;

public record RenombrarCarpetaRequest(@NotBlank String nombre) {
}
