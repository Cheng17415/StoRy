package com.story.model.company;

import com.story.model.CompanyCurrency;
import jakarta.validation.constraints.NotNull;

public record UpdateCompanyCurrencyRequest(
        @NotNull CompanyCurrency currency
) {
}
