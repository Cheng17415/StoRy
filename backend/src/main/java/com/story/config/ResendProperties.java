package com.story.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.resend")
public class ResendProperties {

    private String apiKey = "";
    private String from = "";
    private String inviteBaseUrl = "http://localhost:4200/empresa?inviteToken=";

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getInviteBaseUrl() {
        return inviteBaseUrl;
    }

    public void setInviteBaseUrl(String inviteBaseUrl) {
        this.inviteBaseUrl = inviteBaseUrl;
    }
}
