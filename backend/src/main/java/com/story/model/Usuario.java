package com.story.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UserStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AuthProvider provider;

    @Column(name = "provider_id")
    private String providerId;

    /**
     * Google subject for a LOCAL account that linked Google (Sign-In). Pure GOOGLE accounts use {@link #providerId}.
     */
    @Column(name = "google_provider_id")
    private String googleProviderId;

    @Column(name = "fecha_registro", nullable = false)
    private Instant fechaRegistro = Instant.now();

    @Column(name = "fecha_ultimo_login")
    private Instant fechaUltimoLogin;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public void setProvider(AuthProvider provider) {
        this.provider = provider;
    }

    public String getProviderId() {
        return providerId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public String getGoogleProviderId() {
        return googleProviderId;
    }

    public void setGoogleProviderId(String googleProviderId) {
        this.googleProviderId = googleProviderId;
    }

    public Instant getFechaRegistro() {
        return fechaRegistro;
    }

    public void setFechaRegistro(Instant fechaRegistro) {
        this.fechaRegistro = fechaRegistro;
    }

    public Instant getFechaUltimoLogin() {
        return fechaUltimoLogin;
    }

    public void setFechaUltimoLogin(Instant fechaUltimoLogin) {
        this.fechaUltimoLogin = fechaUltimoLogin;
    }

    /** True if the user can sign in with Google (exclusive GOOGLE account or LOCAL with linked Google sub). */
    public boolean isGoogleConnected() {
        if (this.provider == AuthProvider.GOOGLE) {
            return true;
        }
        return this.googleProviderId != null && !this.googleProviderId.isBlank();
    }
}
