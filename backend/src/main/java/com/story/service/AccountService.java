package com.story.service;

import com.story.model.AuthProvider;
import com.story.model.Usuario;
import com.story.model.auth.AuthUserDto;
import com.story.model.auth.ChangePasswordRequest;
import com.story.model.auth.GoogleAuthRequest;
import com.story.model.auth.UpdateProfileRequest;
import com.story.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final GoogleIdentityTokenService googleIdentityTokenService;
    private final AuthUserMapper authUserMapper;

    public AccountService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            GoogleIdentityTokenService googleIdentityTokenService,
            AuthUserMapper authUserMapper
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.googleIdentityTokenService = googleIdentityTokenService;
        this.authUserMapper = authUserMapper;
    }

    @Transactional(readOnly = true)
    public AuthUserDto getProfile(String username) {
        return authUserMapper.toDto(requireActiveUser(username));
    }

    @Transactional
    public AuthUserDto updateProfile(String username, UpdateProfileRequest request) {
        Usuario u = requireActiveUser(username);
        usuarioRepository
                .findByEmail(request.email())
                .filter(other -> !other.getId().equals(u.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está en uso");
                });
        u.setName(request.name());
        u.setEmail(request.email());
        usuarioRepository.save(u);
        return authUserMapper.toDto(u);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        Usuario u = requireActiveUser(username);
        if (u.getProvider() != AuthProvider.LOCAL || u.getPassword() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Solo las cuentas con contraseña local pueden cambiar la contraseña aquí"
            );
        }
        if (!passwordEncoder.matches(request.currentPassword(), u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "La contraseña actual no es correcta");
        }
        u.setPassword(passwordEncoder.encode(request.newPassword()));
        usuarioRepository.save(u);
    }

    @Transactional
    public AuthUserDto linkGoogle(String username, GoogleAuthRequest request) {
        Usuario u = requireActiveUser(username);
        if (u.getProvider() == AuthProvider.GOOGLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta cuenta ya inicia sesión solo con Google");
        }
        GoogleIdentityTokenService.VerifiedGoogleIdentity id = googleIdentityTokenService.verify(request.idToken());
        if (!id.email().equalsIgnoreCase(u.getEmail())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El correo de Google debe coincidir con el correo de tu cuenta StoRy"
            );
        }
        if (u.getGoogleProviderId() != null && u.getGoogleProviderId().equals(id.sub())) {
            return authUserMapper.toDto(u);
        }
        usuarioRepository
                .findByProviderAndProviderId(AuthProvider.GOOGLE, id.sub())
                .filter(other -> !other.getId().equals(u.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Esta cuenta de Google ya está asociada a otro usuario"
                    );
                });
        usuarioRepository
                .findByGoogleProviderId(id.sub())
                .filter(other -> !other.getId().equals(u.getId()))
                .ifPresent(other -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Esta cuenta de Google ya está asociada a otro usuario"
                    );
                });
        u.setGoogleProviderId(id.sub());
        usuarioRepository.save(u);
        return authUserMapper.toDto(u);
    }

    @Transactional
    public AuthUserDto unlinkGoogle(String username) {
        Usuario u = requireActiveUser(username);
        if (u.getProvider() != AuthProvider.LOCAL) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Para cuentas que solo usan Google, no se puede desvincular desde aquí"
            );
        }
        if (u.getGoogleProviderId() == null || u.getGoogleProviderId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google no está vinculado");
        }
        u.setGoogleProviderId(null);
        usuarioRepository.save(u);
        return authUserMapper.toDto(u);
    }

    private Usuario requireActiveUser(String username) {
        return usuarioRepository
                .findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
    }

}
