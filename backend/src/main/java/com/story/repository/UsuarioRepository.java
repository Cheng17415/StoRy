package com.story.repository;

import com.story.model.AuthProvider;
import com.story.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmail(String email);

    Optional<Usuario> findByUsername(String username);

    Optional<Usuario> findByProviderAndProviderId(AuthProvider provider, String providerId);

    Optional<Usuario> findByGoogleProviderId(String googleProviderId);
}
