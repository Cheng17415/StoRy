package com.story.model;

import java.math.BigDecimal;
import java.util.List;

public record InventarioResultadosResponse(
        BigDecimal valorEntradas,
        BigDecimal valorSalidas,
        BigDecimal valorAjustes,
        BigDecimal resultadoNeto,
        long unidadesEntrada,
        long unidadesSalida,
        long unidadesAjuste,
        int totalMovimientos,
        List<ResultadoProductoLineaResponse> porProducto
) {
}
