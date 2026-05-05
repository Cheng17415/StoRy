package com.story.model.company;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinCompanyRequest(
        @NotBlank @Size(min = 3, max = 150) String name,
        @NotBlank @Size(min = 8, max = 128) String password
) {
}
