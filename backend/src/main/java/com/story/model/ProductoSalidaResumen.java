package com.story.model;

/**
 * Total de unidades en salida en el periodo, por producto.
 */
public record ProductoSalidaResumen(Long productoId, String nombreProducto, long unidadesSalida) {
}
