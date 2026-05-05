package com.story.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.story.config.GoogleOAuthProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;

@Service
public class GoogleIdentityTokenService {

    private final GoogleOAuthProperties googleOAuthProperties;

    public GoogleIdentityTokenService(GoogleOAuthProperties googleOAuthProperties) {
        this.googleOAuthProperties = googleOAuthProperties;
    }

    /**
     * Verifies a Google Sign-In ID token and returns stable identity fields.
     */
    public VerifiedGoogleIdentity verify(String rawIdToken) {
        String clientId = googleOAuthProperties.getClientId();
        if (clientId == null || clientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Inicio de sesión con Google no configurado");
        }
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            ).setAudience(Collections.singletonList(clientId)).build();

            GoogleIdToken idToken = verifier.verify(rawIdToken);
            if (idToken == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token de Google inválido");
            }
            GoogleIdToken.Payload payload = idToken.getPayload();
            Boolean emailVerified = (Boolean) payload.get("email_verified");
            if (Boolean.FALSE.equals(emailVerified)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email de Google no verificado");
            }
            String sub = payload.getSubject();
            String email = payload.getEmail();
            if (email == null || email.isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email no disponible en el token de Google");
            }
            String name = (String) payload.get("name");
            if (name == null || name.isBlank()) {
                name = email.substring(0, email.indexOf('@'));
            }
            return new VerifiedGoogleIdentity(sub, email, name);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No se pudo validar el token de Google", e);
        }
    }

    public record VerifiedGoogleIdentity(String sub, String email, String name) {
    }
}
