package com.story.model.company;

import java.time.Instant;

public record CompanyInvitationDto(
        long id,
        String email,
        String role,
        String status,
        Instant expiresAt,
        Instant createdAt
) {
}
