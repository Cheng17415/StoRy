package com.story.security;

/**
 * Mensajes 403 cuando una acción requiere {@code company_admin}.
 */
public final class CompanyAdminMessages {

    public static final String DEFAULT =
            "Solo el administrador de empresa puede realizar esta acción";

    public static final String UPDATE_CURRENCY =
            "Solo company_admin puede cambiar la moneda de la empresa";

    public static final String UPDATE_NAME =
            "Solo company_admin puede cambiar el nombre de la empresa";

    public static final String UPDATE_PASSWORD =
            "Solo company_admin puede cambiar la contraseña de la empresa";

    public static final String REMOVE_MEMBER =
            "Solo company_admin puede eliminar miembros";

    public static final String CHANGE_MEMBER_ROLE =
            "Solo company_admin puede cambiar roles";

    public static final String INVITE_MEMBER =
            "Solo company_admin puede invitar miembros";

    public static final String DELETE_PRODUCT =
            "Solo company_admin puede eliminar productos";

    public static final String UPDATE_STOCK_MINIMO =
            "Solo company_admin puede actualizar el stock mínimo";

    public static final String DELETE_FOLDER =
            "Solo company_admin puede eliminar carpetas";

    private CompanyAdminMessages() {
    }
}
