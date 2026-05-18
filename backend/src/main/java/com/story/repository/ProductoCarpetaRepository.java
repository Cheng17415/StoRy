package com.story.repository;

import com.story.model.ProductoCarpeta;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductoCarpetaRepository extends JpaRepository<ProductoCarpeta, Long> {

    Optional<ProductoCarpeta> findByIdAndCompany_Id(Long id, Long companyId);

    List<ProductoCarpeta> findAllByCompany_IdOrderByNombreAsc(Long companyId);

    List<ProductoCarpeta> findAllByCompany_IdAndParentIsNullOrderByNombreAsc(Long companyId);

    List<ProductoCarpeta> findAllByCompany_IdAndParent_IdOrderByNombreAsc(Long companyId, Long parentId);
}
