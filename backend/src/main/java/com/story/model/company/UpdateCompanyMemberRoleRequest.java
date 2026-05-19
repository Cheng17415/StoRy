package com.story.model.company;

import com.story.model.CompanyRole;
import jakarta.validation.constraints.NotNull;

public record UpdateCompanyMemberRoleRequest(
        @NotNull CompanyRole role
) {
}
