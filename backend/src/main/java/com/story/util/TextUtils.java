package com.story.util;

public final class TextUtils {

    private TextUtils() {
    }

    /** Texto libre; vacío o solo espacios se normaliza a null. */
    public static String normalizeOptionalText(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
