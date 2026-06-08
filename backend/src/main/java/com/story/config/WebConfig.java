package com.story.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Cloud Run expone dos formatos de URL (*.europe-west1.run.app y *.*.a.run.app).
        var cors = registry.addMapping("/api/**")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowedOriginPatterns(
                        "http://localhost:4200",
                        "https://story-frontend-*.europe-west1.run.app",
                        "https://story-frontend-*.a.run.app"
                );
        for (String origin : allowedOrigins.split("\\s*,\\s*")) {
            if (!origin.isBlank()) {
                cors.allowedOriginPatterns(origin.trim());
            }
        }
    }
}
