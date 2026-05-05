package com.story.service;

import com.story.config.JwtProperties;
import com.story.model.AuthProvider;
import com.story.model.UserStatus;
import com.story.model.Usuario;
import com.story.model.auth.AuthResponse;
import com.story.model.auth.GoogleAuthRequest;
import com.story.model.auth.LoginRequest;
import com.story.model.auth.RegisterRequest;
import com.story.repository.UsuarioRepository;
import com.story.security.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final GoogleIdentityTokenService googleIdentityTokenService;
    private final AuthUserMapper authUserMapper;

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            JwtProperties jwtProperties,
            GoogleIdentityTokenService googleIdentityTokenService,
            AuthUserMapper authUserMapper
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.googleIdentityTokenService = googleIdentityTokenService;
        this.authUserMapper = authUserMapper;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (usuarioRepository.findByEmail(request.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está registrado");
        }
        if (usuarioRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de usuario ya existe");
        }
        Usuario u = new Usuario();
        u.setName(request.name());
        u.setEmail(request.email());
        u.setUsername(request.username());
        u.setPassword(passwordEncoder.encode(request.password()));
        u.setStatus(UserStatus.ACTIVO);
        u.setProvider(AuthProvider.LOCAL);
        u.setProviderId(null);
        u.setGoogleProviderId(null);
        usuarioRepository.save(u);
        return buildAuthResponse(u);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Usuario u = findForLogin(request.usernameOrEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas"));
        if (u.getProvider() != AuthProvider.LOCAL || u.getPassword() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }
        if (!passwordEncoder.matches(request.password(), u.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales inválidas");
        }
        if (u.getStatus() != UserStatus.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cuenta no activa");
        }
        return buildAuthResponse(u);
    }

    @Transactional
    public AuthResponse loginGoogle(GoogleAuthRequest request) {
        GoogleIdentityTokenService.VerifiedGoogleIdentity id = googleIdentityTokenService.verify(request.idToken());
        String sub = id.sub();
        String email = id.email();
        String name = id.name();

        Optional<Usuario> bySub = usuarioRepository.findByProviderAndProviderId(AuthProvider.GOOGLE, sub);
        Usuario u;
        if (bySub.isPresent()) {
            u = bySub.get();
        } else {
            Optional<Usuario> linked = usuarioRepository.findByGoogleProviderId(sub);
            if (linked.isPresent()) {
                u = linked.get();
            } else if (usuarioRepository.findByEmail(email).isPresent()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Ya existe una cuenta con este email. Use el inicio de sesión local o vincule Google desde el perfil."
                );
            } else {
                u = createGoogleUser(sub, email, name);
            }
        }
        if (u.getStatus() != UserStatus.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cuenta no activa");
        }
        return buildAuthResponse(u);
    }

    private Usuario createGoogleUser(String sub, String email, String name) {
        Usuario u = new Usuario();
        u.setName(name);
        u.setEmail(email);
        u.setUsername(uniqueUsernameFromEmail(email));
        u.setPassword(null);
        u.setStatus(UserStatus.ACTIVO);
        u.setProvider(AuthProvider.GOOGLE);
        u.setProviderId(sub);
        u.setGoogleProviderId(null);
        return usuarioRepository.save(u);
    }

    private String uniqueUsernameFromEmail(String email) {
        int at = email.indexOf('@');
        String local = at > 0 ? email.substring(0, at) : email;
        local = local.replaceAll("[^a-zA-Z0-9_]", "_");
        if (local.isEmpty()) {
            local = "user";
        }
        if (local.length() > 60) {
            local = local.substring(0, 60);
        }
        String candidate = local;
        int i = 0;
        while (usuarioRepository.findByUsername(candidate).isPresent()) {
            candidate = local + "_" + (++i);
        }
        return candidate;
    }

    private Optional<Usuario> findForLogin(String q) {
        if (q.contains("@")) {
            return usuarioRepository.findByEmail(q)
                    .or(() -> usuarioRepository.findByUsername(q));
        }
        return usuarioRepository.findByUsername(q)
                .or(() -> usuarioRepository.findByEmail(q));
    }

    private AuthResponse buildAuthResponse(Usuario u) {
        String token = jwtService.generateToken(u.getUsername(), u.getId());
        return AuthResponse.of(token, jwtProperties.getExpirationMs(), authUserMapper.toDto(u));
    }
}
