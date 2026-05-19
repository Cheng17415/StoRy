package com.story.model;

import java.util.List;

public record CarpetaArbolResponse(
        Long id,
        String nombre,
        Long parentId,
        String descripcion,
        List<CarpetaArbolResponse> hijos
) {
}
