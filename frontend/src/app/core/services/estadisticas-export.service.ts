import { Injectable } from '@angular/core';
import ExcelJS from 'exceljs';
import {
  InventarioResultadosDto,
  MovimientoPeriodoDto,
} from '../models/catalogo.models';
import {
  INVENTARIO_EXPORT_COLORS,
  escapeTsvCell,
  hexToArgb,
  hexToRgb,
} from '../utils/inventario-export.util';
import { movCantidadDisplay, tipoMovimientoLabel } from '../utils/catalogo.util';
import { pdfSafeText } from '../utils/pdf-text.util';
import type { MovimientoStockDto } from '../models/catalogo.models';

export interface ExportPeriodoMeta {
  titulo: string;
  subtitulo: string;
  slug: string;
}

@Injectable({ providedIn: 'root' })
export class EstadisticasExportService {
  metaMovimientos(desde: string, hasta: string, count: number): ExportPeriodoMeta {
    return {
      titulo: 'StoRy — Movimientos del periodo',
      subtitulo: `${desde} – ${hasta} · ${count} movimientos · Generado ${new Date().toLocaleString('es')}`,
      slug: `movimientos-${desde}_${hasta}`,
    };
  }

  metaResultados(desde: string, hasta: string): ExportPeriodoMeta {
    return {
      titulo: 'StoRy — Beneficios y pérdidas',
      subtitulo: `${desde} – ${hasta} · Generado ${new Date().toLocaleString('es')}`,
      slug: `resultados-${desde}_${hasta}`,
    };
  }

  async buildMovimientosExcel(
    rows: MovimientoPeriodoDto[],
    meta: ExportPeriodoMeta,
    formatCurrency: (n: number) => string,
  ): Promise<Blob> {
    const ARGB = this.argbPalette();
    const solidFill = (argb: string): ExcelJS.Fill => ({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    });
    const thinBorder = this.thinBorder(ARGB.border);
    const headerBorder = this.headerBorder(ARGB.primaryBorder);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'StoRy';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Movimientos', {
      views: [{ state: 'frozen', ySplit: 4 }],
      properties: { defaultRowHeight: 20 },
    });

    sheet.mergeCells('A1:J1');
    sheet.getCell('A1').value = meta.titulo;
    sheet.getCell('A1').font = { name: 'Calibri', bold: true, size: 14, color: { argb: ARGB.primary } };
    sheet.getRow(1).height = 26;

    sheet.mergeCells('A2:J2');
    sheet.getCell('A2').value = meta.subtitulo;
    sheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: ARGB.meta } };
    sheet.getRow(2).height = 18;
    sheet.getRow(3).height = 8;

    const headerRow = sheet.getRow(4);
    headerRow.values = [
      'Fecha',
      'Tipo',
      'Producto',
      'Código',
      'Categorías',
      'Carpeta',
      'Cantidad',
      'Valor',
      'Usuario',
      'Notas',
    ];
    headerRow.height = 22;
    headerRow.eachCell((cell, col) => {
      cell.fill = solidFill(ARGB.primary);
      cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: ARGB.white } };
      cell.border = headerBorder;
      cell.alignment = { vertical: 'middle', horizontal: col >= 7 ? 'right' : 'left' };
    });

    rows.forEach((m, idx) => {
      const dto: MovimientoStockDto = {
        id: m.id,
        tipo: m.tipo,
        cantidad: m.cantidad,
        fecha: m.fecha,
        observacion: m.observacion,
        usuario: m.usuario,
      };
      const row = sheet.addRow([
        new Date(m.fecha).toLocaleString('es'),
        tipoMovimientoLabel(m.tipo),
        m.productoNombre,
        m.productoCodigo,
        m.categorias,
        m.carpetaNombre,
        movCantidadDisplay(dto),
        formatCurrency(m.valor),
        m.usuario,
        m.observacion ?? '',
      ]);
      const fill = solidFill(idx % 2 === 0 ? ARGB.white : ARGB.rowAlt);
      row.eachCell((cell, col) => {
        cell.fill = fill;
        cell.border = thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col >= 7 ? 'right' : 'left',
          wrapText: col <= 5,
        };
        if (col === 3) {
          cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.text } };
        }
      });
    });

    sheet.columns = [
      { width: 18 },
      { width: 10 },
      { width: 26 },
      { width: 14 },
      { width: 20 },
      { width: 14 },
      { width: 10 },
      { width: 12 },
      { width: 14 },
      { width: 24 },
    ];
    if (sheet.rowCount >= 4) {
      sheet.autoFilter = { from: 'A4', to: `J${sheet.rowCount}` };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  buildMovimientosCsv(rows: MovimientoPeriodoDto[], formatCurrency: (n: number) => string): Blob {
    const sep = '\t';
    const headers = [
      'Fecha',
      'Tipo',
      'Producto',
      'Código',
      'Categorías',
      'Carpeta',
      'Cantidad',
      'Valor',
      'Usuario',
      'Notas',
    ];
    const lines = [headers.map(escapeTsvCell).join(sep)];
    for (const m of rows) {
      const dto: MovimientoStockDto = {
        id: m.id,
        tipo: m.tipo,
        cantidad: m.cantidad,
        fecha: m.fecha,
        observacion: m.observacion,
        usuario: m.usuario,
      };
      lines.push(
        [
          new Date(m.fecha).toLocaleString('es'),
          tipoMovimientoLabel(m.tipo),
          m.productoNombre,
          m.productoCodigo,
          m.categorias,
          m.carpetaNombre,
          movCantidadDisplay(dto),
          formatCurrency(m.valor),
          m.usuario,
          m.observacion ?? '',
        ]
          .map(escapeTsvCell)
          .join(sep),
      );
    }
    return new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  async buildMovimientosPdf(
    rows: MovimientoPeriodoDto[],
    meta: ExportPeriodoMeta,
    formatCurrency: (n: number) => string,
  ): Promise<Blob> {
    const primaryRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.primary);
    const primaryBorderRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.primaryBorder);
    const textRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.text);
    const mutedRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.muted);
    const metaRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.meta);
    const whiteRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.white);
    const rowAltRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.rowAlt);
    const borderRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.border);

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryRgb);
    doc.text(pdfSafeText(meta.titulo), 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...metaRgb);
    doc.text(pdfSafeText(meta.subtitulo), 14, 22);

    autoTable(doc, {
      head: [['Fecha', 'Tipo', 'Producto', 'Codigo', 'Categorias', 'Carpeta', 'Cant.', 'Valor', 'Usuario']],
      body: rows.map((m) => {
        const dto: MovimientoStockDto = {
          id: m.id,
          tipo: m.tipo,
          cantidad: m.cantidad,
          fecha: m.fecha,
          observacion: m.observacion,
          usuario: m.usuario,
        };
        return [
          pdfSafeText(new Date(m.fecha).toLocaleString('es')),
          pdfSafeText(tipoMovimientoLabel(m.tipo)),
          pdfSafeText(m.productoNombre),
          pdfSafeText(m.productoCodigo),
          pdfSafeText(m.categorias),
          pdfSafeText(m.carpetaNombre),
          pdfSafeText(movCantidadDisplay(dto)),
          pdfSafeText(formatCurrency(m.valor)),
          pdfSafeText(m.usuario),
        ];
      }),
      startY: 28,
      margin: { left: 14, right: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: textRgb,
        lineColor: borderRgb,
        lineWidth: 0.1,
        valign: 'middle',
      },
      headStyles: {
        fillColor: primaryRgb,
        textColor: whiteRgb,
        fontStyle: 'bold',
        lineColor: primaryBorderRgb,
      },
      columnStyles: {
        6: { halign: 'right', cellWidth: 16 },
        7: { halign: 'right', cellWidth: 22 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        data.cell.styles.fillColor = data.row.index % 2 === 0 ? whiteRgb : rowAltRgb;
        if (data.column.index === 2) {
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index === 3) {
          data.cell.styles.textColor = mutedRgb;
        }
      },
    });

    return doc.output('blob');
  }

  async buildResultadosExcel(
    r: InventarioResultadosDto,
    meta: ExportPeriodoMeta,
    formatCurrency: (n: number) => string,
  ): Promise<Blob> {
    const ARGB = this.argbPalette();
    const solidFill = (argb: string): ExcelJS.Fill => ({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    });
    const thinBorder = this.thinBorder(ARGB.border);
    const headerBorder = this.headerBorder(ARGB.primaryBorder);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'StoRy';
    const resumen = workbook.addWorksheet('Resumen', { properties: { defaultRowHeight: 20 } });
    const detalle = workbook.addWorksheet('Por producto', {
      views: [{ state: 'frozen', ySplit: 4 }],
      properties: { defaultRowHeight: 20 },
    });

    resumen.mergeCells('A1:B1');
    resumen.getCell('A1').value = meta.titulo;
    resumen.getCell('A1').font = { name: 'Calibri', bold: true, size: 14, color: { argb: ARGB.primary } };
    resumen.getCell('A2').value = meta.subtitulo;
    resumen.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: ARGB.meta } };

    const resumenRows: [string, string][] = [
      ['Valor entradas', formatCurrency(r.valorEntradas)],
      ['Valor salidas', formatCurrency(r.valorSalidas)],
      ['Valor ajustes', formatCurrency(r.valorAjustes)],
      ['Resultado neto (salidas − entradas)', formatCurrency(r.resultadoNeto)],
      ['Unidades entrada', String(r.unidadesEntrada)],
      ['Unidades salida', String(r.unidadesSalida)],
      ['Movimientos', String(r.totalMovimientos)],
    ];
    resumenRows.forEach(([label, value], i) => {
      const row = resumen.getRow(4 + i);
      row.getCell(1).value = label;
      row.getCell(2).value = value;
      row.getCell(1).font = { name: 'Calibri', color: { argb: ARGB.muted } };
      row.getCell(2).font = {
        name: 'Calibri',
        bold: label.startsWith('Resultado'),
        color: { argb: ARGB.text },
      };
    });
    resumen.getColumn(1).width = 28;
    resumen.getColumn(2).width = 22;

    detalle.mergeCells('A1:G1');
    detalle.getCell('A1').value = `${meta.titulo} — detalle`;
    detalle.getCell('A1').font = { name: 'Calibri', bold: true, size: 14, color: { argb: ARGB.primary } };
    detalle.getRow(3).height = 8;

    const h = detalle.getRow(4);
    h.values = ['Producto', 'Código', 'Valor entradas', 'Valor salidas', 'Resultado', 'Uds. entrada', 'Uds. salida'];
    h.eachCell((cell, col) => {
      cell.fill = solidFill(ARGB.primary);
      cell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: ARGB.white } };
      cell.border = headerBorder;
      cell.alignment = { vertical: 'middle', horizontal: col >= 3 ? 'right' : 'left' };
    });

    r.porProducto.forEach((line, idx) => {
      const row = detalle.addRow([
        line.productoNombre,
        line.productoCodigo,
        formatCurrency(line.valorEntradas),
        formatCurrency(line.valorSalidas),
        formatCurrency(line.resultado),
        line.unidadesEntrada,
        line.unidadesSalida,
      ]);
      const neg = line.resultado < 0;
      const fill = solidFill(idx % 2 === 0 ? ARGB.white : ARGB.rowAlt);
      row.eachCell((cell, col) => {
        cell.fill = fill;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: col >= 3 ? 'right' : 'left' };
        if (col === 1) {
          cell.font = { name: 'Calibri', bold: true };
        }
        if (col === 5 && neg) {
          cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.warn } };
        }
        if (col === 5 && !neg && line.resultado > 0) {
          cell.font = { name: 'Calibri', bold: true, color: { argb: hexToArgb(INVENTARIO_EXPORT_COLORS.positive) } };
        }
      });
    });

    detalle.columns = [
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  buildResultadosCsv(r: InventarioResultadosDto, formatCurrency: (n: number) => string): Blob {
    const sep = '\t';
    const lines: string[] = [];
    lines.push(['Concepto', 'Valor'].map(escapeTsvCell).join(sep));
    lines.push(['Valor entradas', formatCurrency(r.valorEntradas)].map(escapeTsvCell).join(sep));
    lines.push(['Valor salidas', formatCurrency(r.valorSalidas)].map(escapeTsvCell).join(sep));
    lines.push(['Resultado neto', formatCurrency(r.resultadoNeto)].map(escapeTsvCell).join(sep));
    lines.push('');
    lines.push(
      ['Producto', 'Código', 'Valor entradas', 'Valor salidas', 'Resultado', 'Uds. entrada', 'Uds. salida']
        .map(escapeTsvCell)
        .join(sep),
    );
    for (const line of r.porProducto) {
      lines.push(
        [
          line.productoNombre,
          line.productoCodigo,
          formatCurrency(line.valorEntradas),
          formatCurrency(line.valorSalidas),
          formatCurrency(line.resultado),
          String(line.unidadesEntrada),
          String(line.unidadesSalida),
        ]
          .map(escapeTsvCell)
          .join(sep),
      );
    }
    return new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  async buildResultadosPdf(
    r: InventarioResultadosDto,
    meta: ExportPeriodoMeta,
    formatCurrency: (n: number) => string,
  ): Promise<Blob> {
    const primaryRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.primary);
    const primaryBorderRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.primaryBorder);
    const textRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.text);
    const metaRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.meta);
    const whiteRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.white);
    const rowAltRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.rowAlt);
    const borderRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.border);
    const warnRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.warn);
    const posRgb = hexToRgb(INVENTARIO_EXPORT_COLORS.positive);

    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryRgb);
    doc.text(pdfSafeText(meta.titulo), 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...metaRgb);
    doc.text(pdfSafeText(meta.subtitulo), 14, 22);

    autoTable(doc, {
      head: [['Concepto', 'Valor']],
      body: [
        ['Valor entradas', pdfSafeText(formatCurrency(r.valorEntradas))],
        ['Valor salidas', pdfSafeText(formatCurrency(r.valorSalidas))],
        ['Resultado neto', pdfSafeText(formatCurrency(r.resultadoNeto))],
        ['Movimientos', String(r.totalMovimientos)],
      ],
      startY: 28,
      margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 10, textColor: textRgb },
      headStyles: { fillColor: primaryRgb, textColor: whiteRgb, lineColor: primaryBorderRgb },
    });

    autoTable(doc, {
      head: [['Producto', 'Entradas', 'Salidas', 'Resultado']],
      body: r.porProducto.map((line) => [
        pdfSafeText(line.productoNombre),
        pdfSafeText(formatCurrency(line.valorEntradas)),
        pdfSafeText(formatCurrency(line.valorSalidas)),
        pdfSafeText(formatCurrency(line.resultado)),
      ]),
      startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 58) + 10,
      margin: { left: 14, right: 14 },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: textRgb,
        lineColor: borderRgb,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: primaryRgb,
        textColor: whiteRgb,
        fontStyle: 'bold',
        lineColor: primaryBorderRgb,
      },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        data.cell.styles.fillColor = data.row.index % 2 === 0 ? whiteRgb : rowAltRgb;
        if (data.column.index === 3) {
          const val = r.porProducto[data.row.index]?.resultado ?? 0;
          if (val < 0) data.cell.styles.textColor = warnRgb;
          if (val > 0) data.cell.styles.textColor = posRgb;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    return doc.output('blob');
  }

  private argbPalette() {
    return {
      primary: hexToArgb(INVENTARIO_EXPORT_COLORS.primary),
      primaryBorder: hexToArgb(INVENTARIO_EXPORT_COLORS.primaryBorder),
      text: hexToArgb(INVENTARIO_EXPORT_COLORS.text),
      muted: hexToArgb(INVENTARIO_EXPORT_COLORS.muted),
      meta: hexToArgb(INVENTARIO_EXPORT_COLORS.meta),
      white: hexToArgb(INVENTARIO_EXPORT_COLORS.white),
      rowAlt: hexToArgb(INVENTARIO_EXPORT_COLORS.rowAlt),
      warn: hexToArgb(INVENTARIO_EXPORT_COLORS.warn),
      border: hexToArgb(INVENTARIO_EXPORT_COLORS.border),
    } as const;
  }

  private thinBorder(borderArgb: string): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin', color: { argb: borderArgb } },
      left: { style: 'thin', color: { argb: borderArgb } },
      bottom: { style: 'thin', color: { argb: borderArgb } },
      right: { style: 'thin', color: { argb: borderArgb } },
    };
  }

  private headerBorder(primaryBorderArgb: string): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin', color: { argb: primaryBorderArgb } },
      left: { style: 'thin', color: { argb: primaryBorderArgb } },
      bottom: { style: 'thin', color: { argb: primaryBorderArgb } },
      right: { style: 'thin', color: { argb: primaryBorderArgb } },
    };
  }
}
