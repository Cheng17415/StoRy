package com.story.controller;

import com.story.model.OpenFoodFactsProductResponse;
import com.story.service.OpenFoodFactsService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/open-food-facts")
public class OpenFoodFactsController {

    private final OpenFoodFactsService openFoodFactsService;

    public OpenFoodFactsController(OpenFoodFactsService openFoodFactsService) {
        this.openFoodFactsService = openFoodFactsService;
    }

    @GetMapping("/product/{codigoBarras}")
    public OpenFoodFactsProductResponse buscarProducto(@PathVariable String codigoBarras) {
        return openFoodFactsService.fetchProduct(codigoBarras)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Producto no encontrado en Open Food Facts"
                ));
    }
}
