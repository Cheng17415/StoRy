package com.story.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /**
     * HMAC secret; must be at least 256 bits (32 bytes) for HS256.
     */
    private String secret = "01234567890123456789012345678901";

    private long expirationMs = 86_400_000L;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public long getExpirationMs() {
        return expirationMs;
    }

    public void setExpirationMs(long expirationMs) {
        this.expirationMs = expirationMs;
    }
}
