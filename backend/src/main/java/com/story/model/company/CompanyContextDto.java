package com.story.model.company;

public record CompanyContextDto(
        long companyId,
        String companyName,
        String currency,
        String role
) {
}
