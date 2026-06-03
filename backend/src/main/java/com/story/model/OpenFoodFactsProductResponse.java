package com.story.model;

import java.util.List;

public record OpenFoodFactsProductResponse(
        String codigoBarras,
        String nombre,
        String imagenUrl,
        String nutriScore,
        List<String> alergenos
) {
}
