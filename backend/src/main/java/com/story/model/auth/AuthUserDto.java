package com.story.model.auth;

public record AuthUserDto(
        long id,
        String name,
        String email,
        String username,
        String provider,
        boolean googleConnected,
        Long companyId,
        String companyName,
        String companyCurrency,
        String companyRole
) {
}
