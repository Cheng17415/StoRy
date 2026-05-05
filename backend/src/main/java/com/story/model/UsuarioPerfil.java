package com.story.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "usuario_perfil")
public class UsuarioPerfil {

    @EmbeddedId
    private UsuarioPerfilId id = new UsuarioPerfilId();

    @MapsId("idUsuario")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @MapsId("idPerfil")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_perfil", nullable = false)
    private Perfil perfil;

    public UsuarioPerfilId getId() {
        return id;
    }

    public void setId(UsuarioPerfilId id) {
        this.id = id;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
        if (id != null && usuario != null && usuario.getId() != null) {
            id.setIdUsuario(usuario.getId());
        }
    }

    public Perfil getPerfil() {
        return perfil;
    }

    public void setPerfil(Perfil perfil) {
        this.perfil = perfil;
        if (id != null && perfil != null && perfil.getId() != null) {
            id.setIdPerfil(perfil.getId());
        }
    }
}
