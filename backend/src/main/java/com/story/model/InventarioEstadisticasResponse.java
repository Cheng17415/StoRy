package com.story.model;

import java.math.BigDecimal;
import java.util.List;

public record InventarioEstadisticasResponse(
        long totalMovimientos,
        long unidadesEntrada,
        long unidadesSalida,
        long unidadesAjuste,
        long totalProductos,
        long productosBajoMinimo,
        long cantidadActualTotal,
        BigDecimal valorInventarioTotal,
        List<SerieDiaMovimiento> seriePorDia,
        List<ProductoSalidaResumen> topSalidasProducto
) {
}
