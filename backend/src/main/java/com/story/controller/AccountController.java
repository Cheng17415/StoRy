package com.story.controller;

import com.story.model.auth.AuthUserDto;
import com.story.model.auth.ChangePasswordRequest;
import com.story.model.auth.GoogleAuthRequest;
import com.story.model.auth.UpdateProfileRequest;
import com.story.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @GetMapping("/me")
    public AuthUserDto me(Authentication authentication) {
        return accountService.getProfile(authentication.getName());
    }

    @PatchMapping("/me")
    public AuthUserDto updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return accountService.updateProfile(authentication.getName(), request);
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        accountService.changePassword(authentication.getName(), request);
    }

    @PostMapping("/link-google")
    public AuthUserDto linkGoogle(
            Authentication authentication,
            @Valid @RequestBody GoogleAuthRequest request
    ) {
        return accountService.linkGoogle(authentication.getName(), request);
    }

    @PostMapping("/unlink-google")
    public AuthUserDto unlinkGoogle(Authentication authentication) {
        return accountService.unlinkGoogle(authentication.getName());
    }
}
