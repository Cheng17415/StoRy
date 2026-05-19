package com.story.controller;

import com.story.model.CarpetaArbolResponse;
import com.story.model.CarpetaResponse;
import com.story.model.ClonarCarpetaRequest;
import com.story.model.ClonarCarpetaResponse;
import com.story.model.CrearCarpetaJsonRequest;
import com.story.model.MoverCarpetaRequest;
import com.story.model.RenombrarCarpetaRequest;
import com.story.service.CarpetaService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/carpetas")
public class CarpetaController {

    private final CarpetaService carpetaService;

    public CarpetaController(CarpetaService carpetaService) {
        this.carpetaService = carpetaService;
    }

    @GetMapping("/arbol")
    public List<CarpetaArbolResponse> arbol() {
        return carpetaService.listarArbol();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public CarpetaResponse crear(@Valid @RequestBody CrearCarpetaJsonRequest body) {
        return carpetaService.crear(body.nombre(), body.parentId(), body.descripcion());
    }

    @PatchMapping("/{id}")
    public CarpetaResponse renombrar(@PathVariable Long id, @Valid @RequestBody RenombrarCarpetaRequest body) {
        return carpetaService.renombrar(id, body.nombre());
    }

    @PatchMapping("/{id}/parent")
    public CarpetaResponse mover(@PathVariable Long id, @Valid @RequestBody MoverCarpetaRequest body) {
        return carpetaService.mover(id, body.parentId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Long id) {
        carpetaService.eliminar(id);
    }

    @PostMapping("/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public ClonarCarpetaResponse clonar(@PathVariable Long id, @RequestBody(required = false) ClonarCarpetaRequest body) {
        Long parentDest = body != null ? body.parentId() : null;
        return carpetaService.clonar(id, parentDest);
    }
}
