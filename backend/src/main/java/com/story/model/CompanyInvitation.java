package com.story.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "company_invitation")
public class CompanyInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(nullable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CompanyRole role;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private InvitationStatus status;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by_user_id", nullable = false)
    private Usuario invitedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_by_user_id")
    private Usuario acceptedByUser;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Company getCompany() {
        return company;
    }

    public void setCompany(Company company) {
        this.company = company;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public CompanyRole getRole() {
        return role;
    }

    public void setRole(CompanyRole role) {
        this.role = role;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public InvitationStatus getStatus() {
        return status;
    }

    public void setStatus(InvitationStatus status) {
        this.status = status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Usuario getInvitedByUser() {
        return invitedByUser;
    }

    public void setInvitedByUser(Usuario invitedByUser) {
        this.invitedByUser = invitedByUser;
    }

    public Usuario getAcceptedByUser() {
        return acceptedByUser;
    }

    public void setAcceptedByUser(Usuario acceptedByUser) {
        this.acceptedByUser = acceptedByUser;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
