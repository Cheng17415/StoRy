package com.story.model.auth;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresInMs,
        AuthUserDto user
) {
    public static AuthResponse of(String accessToken, long expiresInMs, AuthUserDto user) {
        return new AuthResponse(accessToken, "Bearer", expiresInMs, user);
    }
}
