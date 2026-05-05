package com.story.model.company;

import jakarta.validation.constraints.NotBlank;

public record AcceptInvitationRequest(
        @NotBlank String token
) {
}
