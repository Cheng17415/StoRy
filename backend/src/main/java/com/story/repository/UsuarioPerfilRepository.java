package com.story.repository;

import com.story.model.UsuarioPerfil;
import com.story.model.UsuarioPerfilId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioPerfilRepository extends JpaRepository<UsuarioPerfil, UsuarioPerfilId> {
}
