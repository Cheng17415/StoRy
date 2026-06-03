package com.story.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.story.config.OpenFoodFactsProperties;
import com.story.model.OpenFoodFactsProductResponse;
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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class OpenFoodFactsService {

    private static final Logger LOG = LoggerFactory.getLogger(OpenFoodFactsService.class);
    private static final Pattern BARCODE_PATTERN = Pattern.compile("^\\d{8,14}$");
    private static final Pattern NUTRI_SCORE_PATTERN = Pattern.compile("^[a-e]$");

    private final OpenFoodFactsProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public OpenFoodFactsService(OpenFoodFactsProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public Optional<OpenFoodFactsProductResponse> fetchProduct(String rawBarcode) {
        String barcode = normalizeBarcode(rawBarcode);
        if (barcode == null) {
            throw new IllegalArgumentException("El código de barras debe contener entre 8 y 14 dígitos");
        }

        String fields = "product_name,brands,image_front_url,allergens_tags,nutrition_grades";
        String url = properties.normalizedBaseUrl()
                + "/api/v2/product/"
                + barcode
                + "?fields="
                + fields;

        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                    .GET()
                    .header("User-Agent", properties.getUserAgent())
                    .header("Accept", "application/json");

            String authUser = properties.getBasicAuthUsername();
            String authPass = properties.getBasicAuthPassword();
            if (authUser != null && !authUser.isBlank() && authPass != null) {
                String token = Base64.getEncoder().encodeToString(
                        (authUser + ":" + authPass).getBytes(StandardCharsets.UTF_8)
                );
                builder.header("Authorization", "Basic " + token);
            }

            HttpResponse<String> response = httpClient.send(
                    builder.build(),
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() == 404) {
                return Optional.empty();
            }
            if (response.statusCode() == 429) {
                throw new ResponseStatusException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Límite de consultas a Open Food Facts alcanzado; inténtalo en un minuto"
                );
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warn("Open Food Facts respondió {} para barcode {}", response.statusCode(), barcode);
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "No se pudo consultar Open Food Facts"
                );
            }

            JsonNode root = objectMapper.readTree(response.body());
            int status = root.path("status").asInt(0);
            if (status != 1) {
                return Optional.empty();
            }

            JsonNode product = root.path("product");
            String nombre = firstNonBlank(
                    product.path("product_name").asText(null),
                    product.path("brands").asText(null)
            );
            if (nombre == null || nombre.isBlank()) {
                nombre = "Producto " + barcode;
            }

            String nutriScore = normalizeNutriScore(product.path("nutrition_grades").asText(null));
            List<String> alergenos = parseAllergenTags(product.path("allergens_tags"));
            String imagenUrl = blankToNull(product.path("image_front_url").asText(null));

            return Optional.of(new OpenFoodFactsProductResponse(
                    barcode,
                    nombre.trim(),
                    imagenUrl,
                    nutriScore,
                    alergenos
            ));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            LOG.warn("Error de red consultando Open Food Facts para {}", barcode, e);
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "No se pudo consultar Open Food Facts",
                    e
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Consulta a Open Food Facts interrumpida",
                    e
            );
        }
    }

    public static String normalizeBarcode(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.trim().replaceAll("\\s+", "");
        if (!BARCODE_PATTERN.matcher(digits).matches()) {
            return null;
        }
        return digits;
    }

    static String normalizeNutriScore(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String letter = raw.trim().toLowerCase(Locale.ROOT);
        if (letter.length() > 1) {
            letter = letter.substring(0, 1);
        }
        return NUTRI_SCORE_PATTERN.matcher(letter).matches() ? letter : null;
    }

    private static List<String> parseAllergenTags(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) {
            return List.of();
        }
        List<String> tags = new ArrayList<>();
        for (JsonNode item : node) {
            String tag = item.asText(null);
            if (tag != null && !tag.isBlank()) {
                tags.add(tag.trim());
            }
        }
        return List.copyOf(tags);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
