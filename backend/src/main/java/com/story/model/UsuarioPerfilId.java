package com.story.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class UsuarioPerfilId implements Serializable {

    @Column(name = "id_usuario", nullable = false)
    private Long idUsuario;

    @Column(name = "id_perfil", nullable = false)
    private Long idPerfil;

    public UsuarioPerfilId() {
    }

    public UsuarioPerfilId(Long idUsuario, Long idPerfil) {
        this.idUsuario = idUsuario;
        this.idPerfil = idPerfil;
    }

    public Long getIdUsuario() {
        return idUsuario;
    }

    public void setIdUsuario(Long idUsuario) {
        this.idUsuario = idUsuario;
    }

    public Long getIdPerfil() {
        return idPerfil;
    }

    public void setIdPerfil(Long idPerfil) {
        this.idPerfil = idPerfil;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        UsuarioPerfilId that = (UsuarioPerfilId) o;
        return Objects.equals(idUsuario, that.idUsuario) && Objects.equals(idPerfil, that.idPerfil);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idUsuario, idPerfil);
    }
}
