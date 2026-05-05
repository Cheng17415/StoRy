package com.story.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.google")
public class GoogleOAuthProperties {

    /**
     * OAuth 2.0 client ID (Web client) used as audience when verifying ID tokens.
     */
    private String clientId = "";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }
}
