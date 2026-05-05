package com.story.service;

import com.story.config.ResendProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Service
public class ResendEmailService {

    private static final Logger LOG = LoggerFactory.getLogger(ResendEmailService.class);

    private final ResendProperties resendProperties;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public ResendEmailService(ResendProperties resendProperties) {
        this.resendProperties = resendProperties;
    }

    public void sendInvitationEmail(
            String toEmail,
            String companyName,
            String role,
            String invitationUrl,
            String idempotencyKey
    ) {
        if (resendProperties.getApiKey() == null || resendProperties.getApiKey().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "RESEND_API_KEY no configurada"
            );
        }
        if (resendProperties.getFrom() == null || resendProperties.getFrom().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "RESEND_FROM no configurado"
            );
        }

        String payload = """
                {
                  "from":"%s",
                  "to":["%s"],
                  "subject":"Invitacion a empresa %s",
                  "html":"<p>Has sido invitado a la empresa <strong>%s</strong> con rol <strong>%s</strong>.</p><p>Haz clic para aceptar:</p><p><a href=\\"%s\\">Aceptar invitacion</a></p>",
                  "text":"Has sido invitado a la empresa %s con rol %s. Acepta en: %s"
                }
                """.formatted(
                jsonEscape(resendProperties.getFrom()),
                jsonEscape(toEmail),
                jsonEscape(companyName),
                jsonEscape(companyName),
                jsonEscape(role),
                jsonEscape(invitationUrl),
                jsonEscape(companyName),
                jsonEscape(role),
                jsonEscape(invitationUrl)
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.resend.com/emails"))
                .header("Authorization", "Bearer " + resendProperties.getApiKey())
                .header("Content-Type", "application/json")
                .header("Idempotency-Key", idempotencyKey)
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int code = response.statusCode();
            if (code >= 200 && code < 300) {
                return;
            }
            LOG.error("Resend email error status={} body={}", code, response.body());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo enviar la invitacion por correo");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo enviar la invitacion por correo");
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo enviar la invitacion por correo");
        }
    }

    public String buildInvitationUrl(String token) {
        return resendProperties.getInviteBaseUrl() + token;
    }

    private String jsonEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
