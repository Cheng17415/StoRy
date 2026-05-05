package com.story.repository;

import com.story.model.Producto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    Optional<Producto> findByCompany_IdAndCodigo(Long companyId, String codigo);

    boolean existsByCompany_IdAndCodigo(Long companyId, String codigo);

    List<Producto> findAllByCompany_IdOrderByFechaActualizacionDesc(Long companyId);

    Optional<Producto> findByIdAndCompany_Id(Long id, Long companyId);

    List<Producto> findByUsuario_Id(Long usuarioId);

    void deleteByCompany_Id(Long companyId);
}
