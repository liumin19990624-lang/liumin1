
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalAlign } from "docx";

export class DocGenerator {
  // Fix: Completed the createWordDoc function and implemented structured table export logic
  static async createWordDoc(title: string, content: string): Promise<Blob> {
    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          this.createHeaderCell("镜号", 8),
          this.createHeaderCell("画面内容与动作描写 (Visuals)", 42),
          this.createHeaderCell("角色", 12),
          this.createHeaderCell("对白 (Audio)", 38),
        ],
      }),
    ];

    // Simple parser to create initial rows from plain text content
    const lines = content.split('\n').filter(l => l.trim());
    lines.forEach((line, index) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER })], width: { size: 8, type: WidthType.PERCENT } }),
            new TableCell({ children: [new Paragraph({ text: line })], width: { size: 42, type: WidthType.PERCENT } }),
            new TableCell({ children: [new Paragraph({ text: "-" })], width: { size: 12, type: WidthType.PERCENT } }),
            new TableCell({ children: [new Paragraph({ text: "-" })], width: { size: 38, type: WidthType.PERCENT } }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: title,
            heading: "Heading1",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENT,
            },
            rows: tableRows,
          }),
        ],
      }],
    });

    return await Packer.toBlob(doc);
  }

  // Fix: Added missing createHeaderCell static method
  private static createHeaderCell(text: string, widthPercent: number): TableCell {
    return new TableCell({
      children: [new Paragraph({ text, alignment: AlignmentType.CENTER })],
      width: { size: widthPercent, type: WidthType.PERCENT },
      verticalAlign: VerticalAlign.CENTER,
      shading: { fill: "F2F2F2" }
    });
  }

  // Fix: Added missing downloadBlob static method
  static downloadBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
