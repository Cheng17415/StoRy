package com.story.controller;

import com.story.model.CategoriaResponse;
import com.story.service.CatalogoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categorias")
public class CategoriaController {

    private final CatalogoService catalogoService;

    public CategoriaController(CatalogoService catalogoService) {
        this.catalogoService = catalogoService;
    }

    @GetMapping
    public List<CategoriaResponse> listar() {
        return catalogoService.listarCategorias();
    }
}
