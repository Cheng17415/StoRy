package com.story.repository;

import com.story.model.MovimientoStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface MovimientoStockRepository extends JpaRepository<MovimientoStock, Long> {

    List<MovimientoStock> findByProducto_IdOrderByFechaDesc(Long productoId);

    @Query(
            """
            select m from MovimientoStock m
            join fetch m.producto p
            join fetch m.usuario u
            where p.company.id = :companyId
            and m.fecha >= :desde
            and m.fecha < :hasta
            order by m.fecha asc
            """)
    List<MovimientoStock> findByCompanyAndFechaRange(
            @Param("companyId") Long companyId,
            @Param("desde") Instant desde,
            @Param("hasta") Instant hasta);
}
