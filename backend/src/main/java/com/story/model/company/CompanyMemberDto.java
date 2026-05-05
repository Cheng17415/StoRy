package com.story.model.company;

import java.time.Instant;

public record CompanyMemberDto(
        long userId,
        String name,
        String email,
        String username,
        String role,
        Instant joinedAt
) {
}
