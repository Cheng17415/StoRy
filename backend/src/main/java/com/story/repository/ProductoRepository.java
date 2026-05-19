package com.story.repository;



import com.story.model.Producto;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;



import java.util.Collection;

import java.util.List;

import java.util.Optional;



public interface ProductoRepository extends JpaRepository<Producto, Long> {



    Optional<Producto> findByCompany_IdAndCodigo(Long companyId, String codigo);



    boolean existsByCompany_IdAndCodigo(Long companyId, String codigo);



    List<Producto> findAllByCompany_IdOrderByFechaActualizacionDesc(Long companyId);

    @Query("""
            SELECT DISTINCT p FROM Producto p
            LEFT JOIN FETCH p.categorias
            LEFT JOIN FETCH p.carpeta
            WHERE p.company.id = :companyId
            ORDER BY p.fechaActualizacion DESC
            """)
    List<Producto> findAllByCompany_IdWithCategorias(@Param("companyId") Long companyId);

    List<Producto> findAllByCompany_IdAndCarpeta_IdOrderByFechaActualizacionDesc(Long companyId, Long carpetaId);



    List<Producto> findAllByCompany_IdAndCarpetaIsNullOrderByFechaActualizacionDesc(Long companyId);



    @Query("""

            SELECT DISTINCT p FROM Producto p

            LEFT JOIN FETCH p.categorias

            WHERE p.company.id = :companyId

              AND (

                (:carpetaId IS NULL AND p.carpeta IS NULL)

                OR (:carpetaId IS NOT NULL AND p.carpeta.id = :carpetaId)

              )

              AND (

                :categoriaId IS NULL

                OR EXISTS (SELECT c FROM p.categorias c WHERE c.id = :categoriaId)

              )

            ORDER BY p.fechaActualizacion DESC

            """)

    List<Producto> findByCompanyAndCarpetaAndCategoriaOptional(

            @Param("companyId") Long companyId,

            @Param("carpetaId") Long carpetaId,

            @Param("categoriaId") Long categoriaId);



    List<Producto> findAllByCompany_IdAndCarpeta_IdIn(Long companyId, Collection<Long> carpetaIds);



    @Query("""

            SELECT DISTINCT p FROM Producto p

            LEFT JOIN FETCH p.categorias

            WHERE p.id = :id AND p.company.id = :companyId

            """)

    Optional<Producto> findByIdAndCompany_IdWithCategorias(@Param("id") Long id, @Param("companyId") Long companyId);



    Optional<Producto> findByIdAndCompany_Id(Long id, Long companyId);



    List<Producto> findByUsuario_Id(Long usuarioId);



    void deleteByCompany_Id(Long companyId);



    /**

     * Productos activos con umbral definido y cantidad en o por debajo del mínimo.

     * Orden: mayor déficit (stock_minimo − cantidad) primero.

     */

    @Query("""

            SELECT DISTINCT p FROM Producto p

            LEFT JOIN FETCH p.categorias

            WHERE p.company.id = :companyId

              AND p.activo = true

              AND p.stockMinimo IS NOT NULL

              AND p.cantidad <= p.stockMinimo

              AND (

                :categoriaId IS NULL

                OR EXISTS (SELECT c FROM p.categorias c WHERE c.id = :categoriaId)

              )

            ORDER BY p.nombre ASC

            """)

    List<Producto> findBajoStockMinimo(@Param("companyId") Long companyId, @Param("categoriaId") Long categoriaId);

}

