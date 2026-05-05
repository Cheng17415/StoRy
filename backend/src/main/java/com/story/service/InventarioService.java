package com.story.service;

import com.story.model.MovimientoStock;
import com.story.model.MovimientoStockResponse;
import com.story.model.Producto;
import com.story.model.TipoMovimiento;
import com.story.repository.MovimientoStockRepository;
import com.story.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

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
