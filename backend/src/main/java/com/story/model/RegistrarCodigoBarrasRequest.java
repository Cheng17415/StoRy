package com.story.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistrarCodigoBarrasRequest(
        @NotBlank @Size(max = 32) String codigoBarras
) {
}
