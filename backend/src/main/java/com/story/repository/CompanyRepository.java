package com.story.repository;

import com.story.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

    Optional<Company> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
