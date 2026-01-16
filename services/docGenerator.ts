
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";

export class DocGenerator {
  static async createWordDoc(title: string, content: string): Promise<Blob> {
    const lines = content.split('\n');
    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          this.createHeaderCell("镜头ID/时长"),
          this.createHeaderCell("视觉 (Visuals)"),
          this.createHeaderCell("听觉 (Audio)"),
        ],
      }),
    ];

    let currentShot = "";
    let currentV = "";
    let currentA = "";

    lines.forEach(line => {
      const cleaned = line.trim();
      if (cleaned.startsWith('[Shot:')) {
        // 如果有旧数据，先推入一行
        if (currentShot) {
          tableRows.push(this.createDataRow(currentShot, currentV, currentA));
        }
        const shotMatch = cleaned.match(/\[Shot:(.*?)\]/);
        const durMatch = cleaned.match(/\[Duration:(.*?)\]/);
        currentShot = `${shotMatch?.[1] || '--'} (${durMatch?.[1] || '2s'})`;
        currentV = cleaned.split(']').slice(2).join(']').trim(); // 提取视觉描述
        currentA = "";
      } else if (cleaned.startsWith('[角色:')) {
        currentA += cleaned + "\n";
      } else if (cleaned.startsWith('[音效:')) {
        currentA += "SFX: " + cleaned.replace('[音效:', '').replace(']', '') + "\n";
      }
    });
    
    // 推入最后一行
    if (currentShot) tableRows.push(this.createDataRow(currentShot, currentV, currentA));

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: title, bold: true, size: 40 })],
            spacing: { after: 400 }
          }),
          table
        ],
      }],
    });

    return await Packer.toBlob(doc);
  }

  private static createHeaderCell(text: string) {
    return new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
      shading: { fill: "1e293b" },
      borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 } }
    });
  }

  private static createDataRow(shot: string, v: string, a: string) {
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: shot, size: 18, bold: true })] })], width: { size: 15, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })], width: { size: 45, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: a, size: 20, italic: true })] })], width: { size: 40, type: WidthType.PERCENTAGE } }),
      ],
    });
  }

  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
