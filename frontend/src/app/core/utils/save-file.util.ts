type OpcionesSelectorGuardar = {
  suggestedName: string;
  types?: { description: string; accept: Record<string, string[]> }[];
};

type WindowConGuardar = Window & {
  showSaveFilePicker?: (options: OpcionesSelectorGuardar) => Promise<FileSystemFileHandle>;
};

export type GuardarArchivoOpciones = {
  suggestedName: string;
  description: string;
  mimeType: string;
  /** Sin punto, p. ej. `xlsx` */
  extension: string;
};

export type GuardarArchivoResultado =
  | { ok: true }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'error' };

/**
 * Muestra primero el diálogo "Guardar como" y después genera el contenido.
 * Así se conserva el gesto del usuario aunque la generación tarde varios segundos.
 */
export async function guardarArchivoConDialogo(
  crearBlob: () => Promise<Blob> | Blob,
  opciones: GuardarArchivoOpciones,
): Promise<GuardarArchivoResultado> {
  const { suggestedName, description, mimeType, extension } = opciones;

  const win = window as WindowConGuardar;
  if (typeof win.showSaveFilePicker !== 'function') {
    return { ok: false, reason: 'unsupported' };
  }

  try {
    const handle = await win.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description,
          accept: { [mimeType]: [`.${extension}`] },
        },
      ],
    });
    const blob = await crearBlob();
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'error' };
  }
}
