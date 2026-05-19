package com.story.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        JwtProperties.class,
        GoogleOAuthProperties.class,
        UploadProperties.class,
        SupabaseProperties.class,
        ResendProperties.class
})
public class PropertiesConfig {
}
