package com.story.model;

/**
 * Unidades agregadas por tipo de movimiento en un día (calendario UTC).
 */
public record SerieDiaMovimiento(
        String fecha,
        long entradasUnidades,
        long salidasUnidades,
        long ajustesUnidades
) {
}
