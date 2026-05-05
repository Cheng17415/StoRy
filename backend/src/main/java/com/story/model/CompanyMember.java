package com.story.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "company_member")
public class CompanyMember {

    @EmbeddedId
    private CompanyMemberId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("companyId")
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private Usuario user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CompanyRole role;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Instant.now();

    public CompanyMemberId getId() {
        return id;
    }

    public void setId(CompanyMemberId id) {
        this.id = id;
    }

    public Company getCompany() {
        return company;
    }

    public void setCompany(Company company) {
        this.company = company;
    }

    public Usuario getUser() {
        return user;
    }

    public void setUser(Usuario user) {
        this.user = user;
    }

    public CompanyRole getRole() {
        return role;
    }

    public void setRole(CompanyRole role) {
        this.role = role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(Instant joinedAt) {
        this.joinedAt = joinedAt;
    }
}
