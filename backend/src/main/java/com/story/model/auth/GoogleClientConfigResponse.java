package com.story.model.auth;

/**
 * Public OAuth web client id for Google Sign-In (GIS). Safe to expose in the browser.
 */
public record GoogleClientConfigResponse(String clientId) {
}
