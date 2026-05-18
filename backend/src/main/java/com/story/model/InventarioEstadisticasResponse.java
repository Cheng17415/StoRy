package com.story.model;

import java.util.List;

public record InventarioEstadisticasResponse(
        long totalMovimientos,
        long unidadesEntrada,
        long unidadesSalida,
        long unidadesAjuste,
        List<SerieDiaMovimiento> seriePorDia,
        List<ProductoSalidaResumen> topSalidasProducto
) {
}
