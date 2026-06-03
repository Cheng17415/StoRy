package com.story.model;

import java.math.BigDecimal;

public record ResultadoProductoLineaResponse(
        Long productoId,
        String productoNombre,
        String productoCodigo,
        BigDecimal valorEntradas,
        BigDecimal valorSalidas,
        BigDecimal resultado,
        long unidadesEntrada,
        long unidadesSalida
) {
}
