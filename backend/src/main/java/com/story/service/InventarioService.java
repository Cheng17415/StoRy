package com.story.service;

import com.story.model.InventarioEstadisticasResponse;
import com.story.model.MovimientoStock;
import com.story.model.MovimientoStockResponse;
import com.story.model.Producto;
import com.story.model.ProductoSalidaResumen;
import com.story.model.SerieDiaMovimiento;
import com.story.model.TipoMovimiento;
import com.story.repository.MovimientoStockRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class InventarioService {

    private final MovimientoStockRepository movimientoStockRepository;
    private final ProductoRepository productoRepository;
    private final CurrentUserService currentUserService;

    public InventarioService(
            MovimientoStockRepository movimientoStockRepository,
            ProductoRepository productoRepository,
            CurrentUserService currentUserService
    ) {
        this.movimientoStockRepository = movimientoStockRepository;
        this.productoRepository = productoRepository;
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
    public InventarioEstadisticasResponse estadisticas(Instant desde, Instant hasta) {
        currentUserService.requireCompanyAdminOrAnalyticsViewer();
        if (!desde.isBefore(hasta)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El instante 'desde' debe ser anterior a 'hasta'");
        }
        long maxSeconds = 366L * 24 * 3600;
        if (hasta.getEpochSecond() - desde.getEpochSecond() > maxSeconds) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rango máximo: 366 días");
        }
        Long companyId = currentUserService.requireCurrentCompanyId();
        List<MovimientoStock> rows =
                movimientoStockRepository.findByCompanyAndFechaRange(companyId, desde, hasta);

        long unidadesEntrada = 0;
        long unidadesSalida = 0;
        long unidadesAjuste = 0;
        ZoneOffset utc = ZoneOffset.UTC;
        TreeMap<LocalDate, EnumMap<TipoMovimiento, Long>> porDia = new TreeMap<>();
        Map<Long, Long> salidasPorProducto = new HashMap<>();
        Map<Long, String> nombreProducto = new HashMap<>();

        for (MovimientoStock m : rows) {
            LocalDate dia = m.getFecha().atZone(utc).toLocalDate();
            EnumMap<TipoMovimiento, Long> bucket =
                    porDia.computeIfAbsent(dia, d -> new EnumMap<>(TipoMovimiento.class));
            int c = m.getCantidad();
            bucket.merge(m.getTipo(), (long) c, Long::sum);
            switch (m.getTipo()) {
                case ENTRADA -> unidadesEntrada += c;
                case SALIDA -> unidadesSalida += c;
                case AJUSTE -> unidadesAjuste += c;
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
