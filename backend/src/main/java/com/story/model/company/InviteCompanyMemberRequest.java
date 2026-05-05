package com.story.model.company;

import com.story.model.CompanyRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InviteCompanyMemberRequest(
        @NotBlank @Email String email,
        @NotNull CompanyRole role
) {
}
