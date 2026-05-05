package com.story.controller;

import com.story.config.GoogleOAuthProperties;
import com.story.model.auth.AuthResponse;
import com.story.model.auth.GoogleAuthRequest;
import com.story.model.auth.GoogleClientConfigResponse;
import com.story.model.auth.LoginRequest;
import com.story.model.auth.RegisterRequest;
import com.story.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final GoogleOAuthProperties googleOAuthProperties;

    public AuthController(AuthService authService, GoogleOAuthProperties googleOAuthProperties) {
        this.authService = authService;
        this.googleOAuthProperties = googleOAuthProperties;
    }

    @GetMapping("/google-config")
    public GoogleClientConfigResponse googleConfig() {
        String id = googleOAuthProperties.getClientId();
        if (id == null || id.isBlank()) {
            return new GoogleClientConfigResponse("");
        }
        return new GoogleClientConfigResponse(id.trim());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/google")
    public AuthResponse google(@Valid @RequestBody GoogleAuthRequest request) {
        return authService.loginGoogle(request);
    }
}
