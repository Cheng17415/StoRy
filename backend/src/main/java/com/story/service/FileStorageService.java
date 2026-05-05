package com.story.service;

import com.story.config.UploadProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXT = Set.of("jpg", "jpeg", "png", "gif", "webp");

    private final Path uploadRoot;

    public FileStorageService(UploadProperties uploadProperties) {
        this.uploadRoot = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
    }

    @PostConstruct
    void ensureDirectory() {
        try {
            Files.createDirectories(uploadRoot);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo crear el directorio de subidas", e);
        }
    }

    /**
     * Guarda el fichero y devuelve la ruta pública {@code /api/files/{nombre}} o {@code null} si no hay fichero.
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String original = file.getOriginalFilename();
        String ext = extension(original);
        if (!ext.isEmpty() && !ALLOWED_EXT.contains(ext.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Tipo de imagen no permitido (use jpg, png, gif o webp)");
        }
        String storedName = UUID.randomUUID().toString() + (ext.isEmpty() ? "" : "." + ext.toLowerCase(Locale.ROOT));
        Path target = uploadRoot.resolve(storedName).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("Ruta inválida");
        }
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la imagen", e);
        }
        return "/api/files/" + storedName;
    }

    public void deleteIfStored(String publicPath) {
        if (publicPath == null || !publicPath.startsWith("/api/files/")) {
            return;
        }
        String name = publicPath.substring("/api/files/".length());
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return;
        }
        Path target = uploadRoot.resolve(name).normalize();
        if (!target.startsWith(uploadRoot)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // best effort
        }
    }

    public Path getUploadRoot() {
        return uploadRoot;
    }

    private static String extension(String original) {
        if (original == null || original.isBlank()) {
            return "";
        }
        int i = original.lastIndexOf('.');
        if (i < 0 || i == original.length() - 1) {
            return "";
        }
        return original.substring(i + 1);
    }
}
