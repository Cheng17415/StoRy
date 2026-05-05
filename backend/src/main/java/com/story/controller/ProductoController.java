package com.story.controller;

import com.story.model.MovimientoStockResponse;
import com.story.model.ProductoResponse;
import com.story.service.CatalogoService;
import com.story.service.InventarioService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    private final CatalogoService catalogoService;
    private final InventarioService inventarioService;

    public ProductoController(CatalogoService catalogoService, InventarioService inventarioService) {
        this.catalogoService = catalogoService;
        this.inventarioService = inventarioService;
    }

    @GetMapping
    public List<ProductoResponse> listar() {
        return catalogoService.listarProductos();
    }

    @GetMapping("/{id}")
    public ProductoResponse obtener(@PathVariable Long id) {
        return catalogoService.obtenerProducto(id);
    }

    @GetMapping("/{id}/movimientos")
    public List<MovimientoStockResponse> movimientos(@PathVariable Long id) {
        return inventarioService.listarMovimientosPorProducto(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoResponse crear(
            @RequestParam String nombre,
            @RequestParam int cantidad,
            @RequestParam BigDecimal precio,
            @RequestParam(required = false) String stockMinimo,
            @RequestParam(required = false) String descripcion,
            @RequestParam(required = false) MultipartFile imagen
    ) {
        return catalogoService.crearProducto(nombre, cantidad, precio, stockMinimo, descripcion, imagen);
    }

    /**
     * Actualización con multipart (incl. imagen). Se usa POST en lugar de PUT porque Tomcat/Servlet
     * no rellena las partes multipart en PUT de forma fiable; los campos de texto (p. ej. descripcion)
     * llegaban como null.
     */
    @PostMapping(value = "/{id}/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProductoResponse actualizar(
            @PathVariable Long id,
            @RequestParam String nombre,
            @RequestParam int cantidad,
            @RequestParam BigDecimal precio,
            @RequestParam(required = false) String stockMinimo,
            @RequestParam(required = false) String descripcion,
            @RequestParam(required = false) MultipartFile imagen
    ) {
        return catalogoService.actualizarProducto(id, nombre, cantidad, precio, stockMinimo, descripcion, imagen);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Long id) {
        catalogoService.eliminarProducto(id);
    }
}
