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
import java.util.Base64;
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

    /**
     * Guarda una imagen desde Base64 (con o sin prefijo {@code data:image/...;base64,}).
     */
    public String storeImageBase64(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String payload = raw.trim();
        String mimeFromUrl = null;
        if (payload.startsWith("data:")) {
            int comma = payload.indexOf(',');
            if (comma < 0) {
                throw new IllegalArgumentException("Imagen base64 inválida");
            }
            String meta = payload.substring(5, comma);
            int semi = meta.indexOf(';');
            if (semi > 0) {
                mimeFromUrl = meta.substring(0, semi).trim().toLowerCase(Locale.ROOT);
            }
            payload = payload.substring(comma + 1).replaceAll("\\s+", "");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(payload);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Imagen base64 inválida");
        }
        if (bytes.length == 0) {
            return null;
        }
        long max = 5L * 1024 * 1024;
        if (bytes.length > max) {
            throw new IllegalArgumentException("Imagen demasiado grande (máx. 5 MB)");
        }
        String ext = extensionFromMimeOrMagic(mimeFromUrl, bytes);
        if (!ALLOWED_EXT.contains(ext.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Tipo de imagen no permitido (use jpg, png, gif o webp)");
        }
        String storedName = UUID.randomUUID().toString() + "." + ext.toLowerCase(Locale.ROOT);
        Path target = uploadRoot.resolve(storedName).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("Ruta inválida");
        }
        try {
            Files.write(target, bytes);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la imagen", e);
        }
        return "/api/files/" + storedName;
    }

    private static String extensionFromMimeOrMagic(String mimeFromUrl, byte[] bytes) {
        if (mimeFromUrl != null) {
            if (mimeFromUrl.contains("jpeg") || mimeFromUrl.endsWith("/jpg")) {
                return "jpg";
            }
            if (mimeFromUrl.contains("png")) {
                return "png";
            }
            if (mimeFromUrl.contains("gif")) {
                return "gif";
            }
            if (mimeFromUrl.contains("webp")) {
                return "webp";
            }
        }
        return detectExtFromMagic(bytes);
    }

    private static String detectExtFromMagic(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF) {
            return "jpg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 'P'
                && bytes[2] == 'N'
                && bytes[3] == 'G'
                && bytes[4] == '\r'
                && bytes[5] == '\n'
                && bytes[6] == 0x1A
                && bytes[7] == '\n') {
            return "png";
        }
        if (bytes.length >= 6
                && bytes[0] == 'G'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == '8'
                && (bytes[4] == '7' || bytes[4] == '9')
                && bytes[5] == 'a') {
            return "gif";
        }
        if (bytes.length >= 12
                && bytes[0] == 'R'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == 'F'
                && bytes[8] == 'W'
                && bytes[9] == 'E'
                && bytes[10] == 'B'
                && bytes[11] == 'P') {
            return "webp";
        }
        throw new IllegalArgumentException("Tipo de imagen no reconocido (use jpg, png, gif o webp)");
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

    /**
     * Duplica el fichero en disco con un nuevo nombre público, o {@code null} si no hay origen o no existe.
     */
    public String copyIfStored(String publicPath) {
        if (publicPath == null || !publicPath.startsWith("/api/files/")) {
            return null;
        }
        String name = publicPath.substring("/api/files/".length());
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return null;
        }
        Path source = uploadRoot.resolve(name).normalize();
        if (!source.startsWith(uploadRoot) || !Files.isRegularFile(source)) {
            return null;
        }
        String ext = extension(name);
        String storedName = UUID.randomUUID().toString() + (ext.isEmpty() ? "" : "." + ext.toLowerCase(Locale.ROOT));
        Path target = uploadRoot.resolve(storedName).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("Ruta inválida");
        }
        try {
            Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo copiar la imagen", e);
        }
        return "/api/files/" + storedName;
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
