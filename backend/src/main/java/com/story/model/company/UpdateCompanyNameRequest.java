package com.story.model.company;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCompanyNameRequest(
        @NotBlank @Size(min = 3, max = 120) String name
) {
}
