package com.story.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class CompanyMemberId implements Serializable {

    @Column(name = "company_id")
    private Long companyId;

    @Column(name = "user_id")
    private Long userId;

    public CompanyMemberId() {
    }

    public CompanyMemberId(Long companyId, Long userId) {
        this.companyId = companyId;
        this.userId = userId;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public void setCompanyId(Long companyId) {
        this.companyId = companyId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof CompanyMemberId that)) {
            return false;
        }
        return Objects.equals(companyId, that.companyId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(companyId, userId);
    }
}
