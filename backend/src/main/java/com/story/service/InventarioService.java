package com.story.service;

import com.story.model.InventarioEstadisticasResponse;
import com.story.model.MovimientoStock;
import com.story.model.MovimientoStockResponse;
import com.story.model.Producto;
import com.story.model.ProductoSalidaResumen;
import com.story.model.SerieDiaMovimiento;
import com.story.model.TipoMovimiento;
import com.story.repository.CategoriaRepository;
import com.story.repository.MovimientoStockRepository;
import com.story.repository.ProductoCarpetaRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

@Service
public class InventarioService {

    private final MovimientoStockRepository movimientoStockRepository;
    private final ProductoRepository productoRepository;
    private final CategoriaRepository categoriaRepository;
    private final ProductoCarpetaRepository productoCarpetaRepository;
    private final CurrentUserService currentUserService;

    public InventarioService(
            MovimientoStockRepository movimientoStockRepository,
            ProductoRepository productoRepository,
            CategoriaRepository categoriaRepository,
            ProductoCarpetaRepository productoCarpetaRepository,
            CurrentUserService currentUserService
    ) {
        this.movimientoStockRepository = movimientoStockRepository;
        this.productoRepository = productoRepository;
        this.categoriaRepository = categoriaRepository;
        this.productoCarpetaRepository = productoCarpetaRepository;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public long contarMovimientos() {
        return movimientoStockRepository.count();
    }

    @Transactional(readOnly = true)
    public List<MovimientoStockResponse> listarMovimientosPorProducto(Long productoId) {
        Long companyId = currentUserService.requireCurrentCompanyId();
        productoRepository
                .findByIdAndCompany_Id(productoId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));
        return movimientoStockRepository.findByProducto_IdOrderByFechaDesc(productoId).stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Agrega movimientos de la empresa en {@code [desde, hasta)} (instantes UTC) para cuadros de mando y series por día.
     */
    @Transactional(readOnly = true)
    public InventarioEstadisticasResponse estadisticas(
            Instant desde,
            Instant hasta,
            List<Long> categoriaIds,
            List<Long> carpetaIds,
            boolean categoriaRaiz,
            boolean carpetaRaiz
    ) {
        currentUserService.requireCompanyAdminOrAnalyticsViewer();
        if (!desde.isBefore(hasta)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El instante 'desde' debe ser anterior a 'hasta'");
        }
        long maxSeconds = 366L * 24 * 3600;
        if (hasta.getEpochSecond() - desde.getEpochSecond() > maxSeconds) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rango máximo: 366 días");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        List<Long> catFilter = normalizeIdList(categoriaIds);
        List<Long> carpFilter = normalizeIdList(carpetaIds);
        for (Long categoriaId : catFilter) {
            categoriaRepository.findByIdAndCompany_Id(categoriaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Categoría no encontrada"));
        }
        for (Long carpetaId : carpFilter) {
            productoCarpetaRepository.findByIdAndCompany_Id(carpetaId, companyId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Carpeta no encontrada"));
        }
        List<Producto> productos = productoRepository.findAllByCompany_IdWithCategorias(companyId).stream()
                .filter(p -> matchesEstadisticasFilters(p, catFilter, carpFilter, categoriaRaiz, carpetaRaiz))
                .toList();
        Set<Long> productoIds = new HashSet<>();
        for (Producto p : productos) {
            productoIds.add(p.getId());
        }
        List<MovimientoStock> rows = movimientoStockRepository.findByCompanyAndFechaRange(companyId, desde, hasta);
        boolean filtraProducto = !catFilter.isEmpty() || categoriaRaiz || !carpFilter.isEmpty() || carpetaRaiz;
        if (filtraProducto) {
            rows = rows.stream()
                    .filter(m -> productoIds.contains(m.getProducto().getId()))
                    .toList();
        }

        long unidadesEntrada = 0;
        long unidadesSalida = 0;
        long unidadesAjuste = 0;
        BigDecimal valorEntrada = BigDecimal.ZERO;
        BigDecimal valorSalida = BigDecimal.ZERO;
        BigDecimal valorAjuste = BigDecimal.ZERO;
        long cantidadActualTotal = 0;
        long productosBajoMinimo = 0;
        BigDecimal valorInventarioTotal = BigDecimal.ZERO;
        ZoneOffset utc = ZoneOffset.UTC;
        TreeMap<LocalDate, EnumMap<TipoMovimiento, Long>> porDia = new TreeMap<>();
        Map<Long, Long> salidasPorProducto = new HashMap<>();
        Map<Long, String> nombreProducto = new HashMap<>();

        for (Producto p : productos) {
            int cantidad = p.getCantidad() != null ? p.getCantidad() : 0;
            cantidadActualTotal += cantidad;
            if (Boolean.TRUE.equals(p.getActivo()) && p.getStockMinimo() != null && cantidad <= p.getStockMinimo()) {
                productosBajoMinimo++;
            }
            if (p.getPrecio() != null) {
                valorInventarioTotal = valorInventarioTotal.add(p.getPrecio().multiply(BigDecimal.valueOf(cantidad)));
            }
        }

        for (MovimientoStock m : rows) {
            LocalDate dia = m.getFecha().atZone(utc).toLocalDate();
            EnumMap<TipoMovimiento, Long> bucket =
                    porDia.computeIfAbsent(dia, d -> new EnumMap<>(TipoMovimiento.class));
            int c = m.getCantidad();
            bucket.merge(m.getTipo(), (long) c, Long::sum);
            switch (m.getTipo()) {
                case ENTRADA -> {
                    unidadesEntrada += c;
                    valorEntrada = valorEntrada.add(valorMovimiento(m, c));
                }
                case SALIDA -> {
                    unidadesSalida += c;
                    valorSalida = valorSalida.add(valorMovimiento(m, c));
                }
                case AJUSTE -> {
                    unidadesAjuste += c;
                    valorAjuste = valorAjuste.add(valorMovimiento(m, c));
                }
            }
            if (m.getTipo() == TipoMovimiento.SALIDA) {
                Producto p = m.getProducto();
                salidasPorProducto.merge(p.getId(), (long) c, Long::sum);
                nombreProducto.putIfAbsent(p.getId(), p.getNombre());
            }
        }

        List<SerieDiaMovimiento> serie = new ArrayList<>();
        for (Map.Entry<LocalDate, EnumMap<TipoMovimiento, Long>> e : porDia.entrySet()) {
            EnumMap<TipoMovimiento, Long> b = e.getValue();
            serie.add(new SerieDiaMovimiento(
                    e.getKey().toString(),
                    b.getOrDefault(TipoMovimiento.ENTRADA, 0L),
                    b.getOrDefault(TipoMovimiento.SALIDA, 0L),
                    b.getOrDefault(TipoMovimiento.AJUSTE, 0L)));
        }

        List<ProductoSalidaResumen> topSalidas = salidasPorProducto.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .limit(10)
                .map(en -> new ProductoSalidaResumen(
                        en.getKey(), nombreProducto.getOrDefault(en.getKey(), "?"), en.getValue()))
                .toList();

        return new InventarioEstadisticasResponse(
                rows.size(),
                unidadesEntrada,
                unidadesSalida,
                unidadesAjuste,
                valorEntrada,
                valorSalida,
                valorAjuste,
                productos.size(),
                productosBajoMinimo,
                cantidadActualTotal,
                valorInventarioTotal,
                serie,
                topSalidas);
    }

    /**
     * Registra el primer movimiento al crear un producto (solo si el stock inicial es mayor que cero).
     */
    @Transactional
    public void registrarStockInicial(Producto producto, int cantidadInicial) {
        if (cantidadInicial <= 0) {
            return;
        }
        MovimientoStock m = nuevoMovimientoBase(producto);
        m.setTipo(TipoMovimiento.ENTRADA);
        m.setCantidad(cantidadInicial);
        m.setObservacion("Stock inicial");
        movimientoStockRepository.save(m);
    }

    /**
     * Tras editar cantidad: entrada si aumenta, salida si disminuye; sin movimiento si no cambia.
     */
    @Transactional
    public void registrarCambioStockPorEdicion(Producto producto, int cantidadAnterior, int cantidadNueva) {
        int delta = cantidadNueva - cantidadAnterior;
        if (delta == 0) {
            return;
        }
        MovimientoStock m = nuevoMovimientoBase(producto);
        if (delta > 0) {
            m.setTipo(TipoMovimiento.ENTRADA);
            m.setCantidad(delta);
        } else {
            m.setTipo(TipoMovimiento.SALIDA);
            m.setCantidad(-delta);
        }
        movimientoStockRepository.save(m);
    }

    @Transactional
    public MovimientoStockResponse registrarMovimientoManual(
            Long productoId,
            TipoMovimiento tipo,
            int cantidad,
            String observacionRaw
    ) {
        currentUserService.requireRoleAtLeastEmployee();
        Long companyId = currentUserService.requireCurrentCompanyId();
        Producto p = productoRepository
                .findByIdAndCompany_Id(productoId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado"));

        String observacion = normalizeObservacion(observacionRaw);
        int anterior = p.getCantidad();
        final int movCantidadEnRegistro;
        final int nuevo;

        if (tipo == TipoMovimiento.ENTRADA) {
            if (cantidad < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La entrada debe ser de al menos 1 unidad");
            }
            nuevo = anterior + cantidad;
            movCantidadEnRegistro = cantidad;
        } else if (tipo == TipoMovimiento.SALIDA) {
            if (cantidad < 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La salida debe ser de al menos 1 unidad");
            }
            if (anterior < cantidad) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stock insuficiente para esta salida");
            }
            nuevo = anterior - cantidad;
            movCantidadEnRegistro = cantidad;
        } else if (tipo == TipoMovimiento.AJUSTE) {
            if (cantidad < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad tras el ajuste no puede ser negativa");
            }
            if (cantidad == anterior) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La cantidad es igual al stock actual");
            }
            nuevo = cantidad;
            movCantidadEnRegistro = nuevo;
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de movimiento no soportado");
        }

        p.setCantidad(nuevo);
        p.setFechaActualizacion(Instant.now());
        productoRepository.save(p);

        MovimientoStock m = nuevoMovimientoBase(p);
        m.setTipo(tipo);
        m.setCantidad(movCantidadEnRegistro);
        m.setObservacion(observacion);
        movimientoStockRepository.save(m);

        return toResponse(m);
    }

    private static BigDecimal valorMovimiento(MovimientoStock m, int unidades) {
        if (unidades <= 0) {
            return BigDecimal.ZERO;
        }
        Producto p = m.getProducto();
        if (p.getPrecio() == null) {
            return BigDecimal.ZERO;
        }
        return p.getPrecio().multiply(BigDecimal.valueOf(unidades));
    }

    private static List<Long> normalizeIdList(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return ids.stream().filter(id -> id != null && id > 0).distinct().toList();
    }

    private static boolean matchesEstadisticasFilters(
            Producto p,
            List<Long> categoriaIds,
            List<Long> carpetaIds,
            boolean categoriaRaiz,
            boolean carpetaRaiz
    ) {
        if (categoriaRaiz || !categoriaIds.isEmpty()) {
            boolean sinCategorias = p.getCategorias() == null || p.getCategorias().isEmpty();
            boolean enCategoriaSeleccionada =
                    !categoriaIds.isEmpty()
                            && p.getCategorias().stream().anyMatch(c -> categoriaIds.contains(c.getId()));
            boolean matchCategoria = (categoriaRaiz && sinCategorias) || enCategoriaSeleccionada;
            if (!matchCategoria) {
                return false;
            }
        }
        if (carpetaRaiz || !carpetaIds.isEmpty()) {
            boolean sinCarpeta = p.getCarpeta() == null;
            boolean enCarpetaSeleccionada =
                    !carpetaIds.isEmpty()
                            && p.getCarpeta() != null
                            && carpetaIds.contains(p.getCarpeta().getId());
            boolean matchCarpeta = (carpetaRaiz && sinCarpeta) || enCarpetaSeleccionada;
            if (!matchCarpeta) {
                return false;
            }
        }
        return true;
    }

    private static String normalizeObservacion(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }

    private MovimientoStock nuevoMovimientoBase(Producto producto) {
        MovimientoStock m = new MovimientoStock();
        m.setProducto(producto);
        m.setUsuario(currentUserService.requireCurrentUsuario());
        m.setFecha(Instant.now());
        return m;
    }

    private MovimientoStockResponse toResponse(MovimientoStock m) {
        return new MovimientoStockResponse(
                m.getId(),
                m.getTipo().name(),
                m.getCantidad(),
                m.getFecha(),
                m.getObservacion(),
                m.getUsuario().getUsername()
        );
    }
}
