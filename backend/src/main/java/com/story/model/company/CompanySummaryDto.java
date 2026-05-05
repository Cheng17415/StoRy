package com.story.model.company;

public record CompanySummaryDto(
        long id,
        String name,
        String currency,
        String role
) {
}
