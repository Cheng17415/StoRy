package com.story.controller;

import com.story.model.AgregarProductoCategoriaRequest;
import com.story.model.ActualizarStockMinimoRequest;
import com.story.model.InventarioEstadisticasResponse;
import com.story.model.MovimientoStockResponse;
import com.story.model.MoverProductoCarpetaRequest;
import com.story.model.ProductoResponse;
import com.story.model.RegistrarMovimientoRequest;
import com.story.service.CatalogoService;
import com.story.service.InventarioService;
import org.springframework.format.annotation.DateTimeFormat;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
    public List<ProductoResponse> listar(
            @RequestParam(required = false) Long carpetaId,
            @RequestParam(required = false) Long categoriaId,
            @RequestParam(required = false, defaultValue = "false") boolean bajoMinimo) {
        if (bajoMinimo) {
            return catalogoService.listarProductosBajoMinimo(categoriaId);
        }
        return catalogoService.listarProductos(carpetaId, categoriaId);
    }

    /** Alias legacy; preferir {@code GET /api/productos?bajoMinimo=true}. */
    @GetMapping("/bajo-minimo")
    public List<ProductoResponse> listarBajoMinimo(@RequestParam(required = false) Long categoriaId) {
        return catalogoService.listarProductosBajoMinimo(categoriaId);
    }

    /**
     * Catálogo completo de la empresa (todas las carpetas). Debe declararse antes de {@code /{id}}.
     */
    @GetMapping("/todos")
    public List<ProductoResponse> listarTodos() {
        return catalogoService.listarTodosLosProductosDeLaEmpresa();
    }

    /**
     * Estadísticas de movimientos de stock por periodo (misma autenticación que el resto de {@code /api/productos}).
     * Autorización de rol en {@link InventarioService#estadisticas}.
     */
    @GetMapping("/estadisticas")
    public InventarioEstadisticasResponse estadisticasInventario(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(name = "categoriaIds", required = false) List<Long> categoriaIds,
            @RequestParam(name = "carpetaIds", required = false) List<Long> carpetaIds,
            @RequestParam(name = "categoriaId", required = false) Long categoriaIdLegacy) {
        if (desde.isAfter(hasta)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "desde no puede ser posterior a hasta");
        }
        Instant desdeInstant = desde.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant hastaInstant = hasta.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Long> mergedCategorias = mergeFilterIds(categoriaIds, categoriaIdLegacy);
        return inventarioService.estadisticas(desdeInstant, hastaInstant, mergedCategorias, carpetaIds);
    }

    private static List<Long> mergeFilterIds(List<Long> ids, Long legacyId) {
        if (ids != null && !ids.isEmpty()) {
            return ids;
        }
        if (legacyId != null && legacyId > 0) {
            return List.of(legacyId);
        }
        return List.of();
    }

    @GetMapping("/{id:\\d+}")
    public ProductoResponse obtener(@PathVariable Long id) {
        return catalogoService.obtenerProducto(id);
    }

    @GetMapping("/{id}/movimientos")
    public List<MovimientoStockResponse> movimientos(@PathVariable Long id) {
        return inventarioService.listarMovimientosPorProducto(id);
    }

    @PostMapping("/{id}/movimiento")
    public MovimientoStockResponse registrarMovimiento(
            @PathVariable Long id,
            @Valid @RequestBody RegistrarMovimientoRequest body
    ) {
        return inventarioService.registrarMovimientoManual(
                id,
                body.tipo(),
                body.cantidad(),
                body.observacion()
        );
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoResponse crear(
            @RequestParam String nombre,
            @RequestParam int cantidad,
            @RequestParam BigDecimal precio,
            @RequestParam(required = false) String stockMinimo,
            @RequestParam(required = false) String descripcion,
            @RequestParam(required = false) MultipartFile imagen,
            @RequestParam(required = false) Long carpetaId
    ) {
        return catalogoService.crearProducto(nombre, cantidad, precio, stockMinimo, descripcion, imagen, carpetaId);
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
            @RequestParam(required = false) MultipartFile imagen,
            @RequestParam(required = false) String carpetaId
    ) {
        return catalogoService.actualizarProducto(id, nombre, cantidad, precio, stockMinimo, descripcion, imagen, carpetaId);
    }

    @PatchMapping("/{id}/carpeta")
    public ProductoResponse moverCarpeta(@PathVariable Long id, @RequestBody MoverProductoCarpetaRequest body) {
        return catalogoService.moverProductoCarpeta(id, body.carpetaId());
    }

    @PatchMapping("/{id}/stock-minimo")
    public ProductoResponse actualizarStockMinimo(
            @PathVariable Long id,
            @RequestBody ActualizarStockMinimoRequest body
    ) {
        return catalogoService.actualizarStockMinimo(id, body.stockMinimo());
    }

    @PostMapping("/{id}/categorias")
    public ProductoResponse agregarCategoria(
            @PathVariable Long id,
            @Valid @RequestBody AgregarProductoCategoriaRequest body) {
        return catalogoService.agregarProductoCategoria(id, body.categoriaId(), body.nombre());
    }

    @DeleteMapping("/{id}/categorias/{categoriaId}")
    public ProductoResponse quitarCategoria(
            @PathVariable Long id,
            @PathVariable Long categoriaId) {
        return catalogoService.quitarProductoCategoria(id, categoriaId);
    }

    @PostMapping("/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoResponse clonar(@PathVariable Long id) {
        return catalogoService.clonarProducto(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Long id) {
        catalogoService.eliminarProducto(id);
    }
}
