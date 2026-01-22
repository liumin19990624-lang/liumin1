
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } from "docx";

export class DocGenerator {
  static async createWordDoc(title: string, content: string): Promise<Blob> {
    // 解析剧本内容为结构化数据
    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          this.createHeaderCell("镜号", 8),
          this.createHeaderCell("画面内容与动作描写 (Visuals)", 42),
          this.createHeaderCell("角色", 12),
          this.createHeaderCell("对白 (Dialogue)", 28),
          this.createHeaderCell("音效/BGM", 10),
        ],
      }),
    ];

    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    let currentShotNum = 1;

    lines.forEach(line => {
      if (line.includes('（镜头：') || line.startsWith('镜头')) {
        const visual = line.replace(/（镜头：/g, '').replace(/）/g, '').replace(/镜头\d+：/g, '');
        tableRows.push(new TableRow({
          children: [
            this.createDataCell(currentShotNum.toString().padStart(2, '0'), true),
            this.createDataCell(visual),
            this.createDataCell("---"),
            this.createDataCell("---"),
            this.createDataCell("Ambient"),
          ]
        }));
        currentShotNum++;
      } else if (line.includes('：') && !line.startsWith('场景')) {
        const [char, dialogue] = line.split('：');
        // 尝试合并到上一行（如果是分镜下的台词）或另起一行
        tableRows.push(new TableRow({
          children: [
            this.createDataCell(""),
            this.createDataCell(""),
            this.createDataCell(char, true),
            this.createDataCell(dialogue, false, true),
            this.createDataCell("VO"),
          ]
        }));
      }
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: title, bold: true, size: 36, font: "Microsoft YaHei" }),
            ],
            spacing: { after: 400 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        ],
      }],
    });

    return await Packer.toBlob(doc);
  }

  private static createHeaderCell(text: string, width: number) {
    return new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ 
        children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Microsoft YaHei" })], 
        alignment: AlignmentType.CENTER 
      })],
      shading: { fill: "2563EB" },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 100, right: 100 }
    });
  }

  private static createDataCell(text: string, isBold: boolean = false, isItalic: boolean = false) {
    return new TableCell({
      children: [new Paragraph({ 
        children: [new TextRun({ text, size: 18, bold: isBold, italic: isItalic, font: "Microsoft YaHei" })],
        spacing: { before: 80, after: 80 }
      })],
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" }
      }
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
