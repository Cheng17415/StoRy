package com.story.model.company;

import java.util.List;

public record CompanyPageDto(
        CompanySummaryDto company,
        List<CompanyMemberDto> members,
        List<CompanyInvitationDto> invitations
) {
}
