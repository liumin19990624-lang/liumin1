
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";

export class DocGenerator {
  static async createWordDoc(title: string, content: string): Promise<Blob> {
    const lines = content.split('\n');
    const paragraphs = lines.map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 24, // 12pt
          }),
        ],
        spacing: {
          after: 200,
        },
      });
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 36,
              }),
            ],
            spacing: {
              after: 400,
            },
          }),
          ...paragraphs,
        ],
      }],
    });

    return await Packer.toBlob(doc);
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
