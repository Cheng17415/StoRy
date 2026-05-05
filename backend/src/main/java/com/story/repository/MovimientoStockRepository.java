package com.story.repository;

import com.story.model.MovimientoStock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MovimientoStockRepository extends JpaRepository<MovimientoStock, Long> {

    List<MovimientoStock> findByProducto_IdOrderByFechaDesc(Long productoId);
}
