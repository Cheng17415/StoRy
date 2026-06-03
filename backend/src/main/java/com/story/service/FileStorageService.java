package com.story.service;

import com.story.config.SupabaseProperties;
import com.story.config.UploadProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger LOG = LoggerFactory.getLogger(FileStorageService.class);
    private static final Set<String> ALLOWED_EXT = Set.of("jpg", "jpeg", "png", "gif", "webp");
    private static final long MAX_BYTES = 5L * 1024 * 1024;

    private final SupabaseProperties supabaseProperties;
    private final Path uploadRoot;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public FileStorageService(SupabaseProperties supabaseProperties, UploadProperties uploadProperties) {
        this.supabaseProperties = supabaseProperties;
        this.uploadRoot = Paths.get(uploadProperties.getDir()).toAbsolutePath().normalize();
    }

    @PostConstruct
    void ensureLegacyDirectory() {
        try {
            Files.createDirectories(uploadRoot);
        } catch (IOException e) {
            LOG.warn("No se pudo crear el directorio legacy de subidas: {}", uploadRoot);
        }
    }

    /**
     * Guarda el fichero en Supabase Storage (bucket {@code imagenes}) y devuelve la URL pública.
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
        try {
            byte[] bytes = file.getBytes();
            validateSize(bytes.length);
            String storedName = newStoredName(ext);
            String contentType = contentTypeForExt(ext);
            uploadToSupabase(storedName, bytes, contentType);
            return publicUrl(storedName);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la imagen", e);
        }
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
        validateSize(bytes.length);
        String ext = extensionFromMimeOrMagic(mimeFromUrl, bytes);
        if (!ALLOWED_EXT.contains(ext.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Tipo de imagen no permitido (use jpg, png, gif o webp)");
        }
        String storedName = newStoredName(ext);
        uploadToSupabase(storedName, bytes, contentTypeForExt(ext));
        return publicUrl(storedName);
    }

    public void deleteIfStored(String publicPath) {
        if (publicPath == null || publicPath.isBlank()) {
            return;
        }
        parseSupabaseObjectName(publicPath).ifPresentOrElse(
                this::deleteFromSupabase,
                () -> deleteLegacyLocal(publicPath)
        );
    }

    /**
     * Duplica el fichero con un nuevo nombre y devuelve la nueva URL pública, o {@code null} si no hay origen.
     * Las URLs externas (p. ej. Open Food Facts) se devuelven sin cambios.
     */
    public String duplicateOrPassthrough(String publicPath) {
        if (publicPath == null || publicPath.isBlank()) {
            return null;
        }
        if (publicPath.startsWith("http") && parseSupabaseObjectName(publicPath).isEmpty()) {
            return publicPath;
        }
        return copyIfStored(publicPath);
    }

    /**
     * Duplica el fichero con un nuevo nombre y devuelve la nueva URL pública, o {@code null} si no hay origen.
     */
    public String copyIfStored(String publicPath) {
        if (publicPath == null || publicPath.isBlank()) {
            return null;
        }
        Optional<String> supabaseObject = parseSupabaseObjectName(publicPath);
        if (supabaseObject.isPresent()) {
            return copySupabaseObject(supabaseObject.get());
        }
        return copyLegacyLocal(publicPath);
    }

    /** Directorio local legacy ({@code /api/files/...}); solo lectura de ficheros antiguos. */
    public Path getUploadRoot() {
        return uploadRoot;
    }

    private String copySupabaseObject(String sourceObject) {
        byte[] bytes = downloadSupabaseObject(sourceObject);
        if (bytes == null || bytes.length == 0) {
            return null;
        }
        String ext = extension(sourceObject);
        String storedName = newStoredName(ext);
        uploadToSupabase(storedName, bytes, contentTypeForExt(ext));
        return publicUrl(storedName);
    }

    private byte[] downloadSupabaseObject(String objectName) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(publicUrl(objectName)))
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                return null;
            }
            return response.body();
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            LOG.warn("No se pudo descargar {} desde Supabase Storage", objectName, e);
            return null;
        }
    }

    private void uploadToSupabase(String objectName, byte[] bytes, String contentType) {
        requireSupabaseConfigured();
        String bucket = supabaseProperties.getBucket();
        String encodedPath = encodeObjectPath(objectName);
        URI uri = URI.create(supabaseProperties.normalizedUrl() + "/storage/v1/object/" + bucket + "/" + encodedPath);
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .header("Authorization", "Bearer " + supabaseProperties.getServiceRoleKey())
                    .header("apikey", supabaseProperties.getServiceRoleKey())
                    .header("Content-Type", contentType)
                    .header("x-upsert", "true")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(bytes))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.error("Supabase Storage upload failed ({}): {}", response.statusCode(), response.body());
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "No se pudo guardar la imagen en Supabase Storage"
                );
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UncheckedIOException("No se pudo guardar la imagen en Supabase Storage", new IOException(e));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la imagen en Supabase Storage", e);
        }
    }

    private void deleteFromSupabase(String objectName) {
        requireSupabaseConfigured();
        String bucket = supabaseProperties.getBucket();
        String encodedPath = encodeObjectPath(objectName);
        URI uri = URI.create(supabaseProperties.normalizedUrl() + "/storage/v1/object/" + bucket + "/" + encodedPath);
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .header("Authorization", "Bearer " + supabaseProperties.getServiceRoleKey())
                    .header("apikey", supabaseProperties.getServiceRoleKey())
                    .DELETE()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200 && response.statusCode() != 204 && response.statusCode() != 404) {
                LOG.warn("Supabase Storage delete failed ({}): {}", response.statusCode(), response.body());
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            LOG.warn("No se pudo eliminar {} de Supabase Storage", objectName, e);
        }
    }

    private void requireSupabaseConfigured() {
        if (supabaseProperties.normalizedUrl().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "SUPABASE_URL no configurada"
            );
        }
        if (supabaseProperties.getServiceRoleKey() == null || supabaseProperties.getServiceRoleKey().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "SUPABASE_SERVICE_ROLE_KEY no configurada"
            );
        }
    }

    private String publicUrl(String objectName) {
        String bucket = supabaseProperties.getBucket();
        return supabaseProperties.normalizedUrl()
                + "/storage/v1/object/public/"
                + bucket
                + "/"
                + encodeObjectPath(objectName);
    }

    private Optional<String> parseSupabaseObjectName(String publicPath) {
        String bucket = supabaseProperties.getBucket();
        String marker = "/storage/v1/object/public/" + bucket + "/";
        String path = publicPath;
        int markerIdx = path.indexOf(marker);
        if (markerIdx >= 0) {
            path = path.substring(markerIdx + marker.length());
        } else if (!path.startsWith("http") && !path.startsWith("/api/files/")) {
            return Optional.of(path);
        } else {
            return Optional.empty();
        }
        if (path.isBlank() || path.contains("..") || path.contains("/") || path.contains("\\")) {
            return Optional.empty();
        }
        return Optional.of(path);
    }

    private void deleteLegacyLocal(String publicPath) {
        if (!publicPath.startsWith("/api/files/")) {
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

    private String copyLegacyLocal(String publicPath) {
        if (!publicPath.startsWith("/api/files/")) {
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
        String storedName = newStoredName(ext);
        try {
            byte[] bytes = Files.readAllBytes(source);
            uploadToSupabase(storedName, bytes, contentTypeForExt(ext));
            return publicUrl(storedName);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo copiar la imagen", e);
        }
    }

    private static String newStoredName(String ext) {
        return UUID.randomUUID().toString() + (ext.isEmpty() ? "" : "." + ext.toLowerCase(Locale.ROOT));
    }

    private static void validateSize(long length) {
        if (length > MAX_BYTES) {
            throw new IllegalArgumentException("Imagen demasiado grande (máx. 5 MB)");
        }
    }

    private static String encodeObjectPath(String objectName) {
        int slash = objectName.lastIndexOf('/');
        if (slash < 0) {
            return URLEncoder.encode(objectName, StandardCharsets.UTF_8).replace("+", "%20");
        }
        String dir = objectName.substring(0, slash + 1);
        String file = objectName.substring(slash + 1);
        return dir + URLEncoder.encode(file, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String contentTypeForExt(String ext) {
        if (ext == null || ext.isBlank()) {
            return "application/octet-stream";
        }
        return switch (ext.toLowerCase(Locale.ROOT)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            default -> "application/octet-stream";
        };
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
