package com.story.repository;

import com.story.model.Categoria;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {

    List<Categoria> findAllByCompany_IdOrderByNombreAsc(Long companyId);

    Optional<Categoria> findByIdAndCompany_Id(Long id, Long companyId);

    boolean existsByCompany_IdAndNombreIgnoreCase(Long companyId, String nombre);

    Optional<Categoria> findByCompany_IdAndNombreIgnoreCase(Long companyId, String nombre);
}
