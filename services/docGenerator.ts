import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  VerticalAlign,
  TableBorders
} from "docx";

export class DocGenerator {
  /**
   * 创建动画剧本 Word 文档
   * @param title 文档标题
   * @param content 剧本纯文本内容
   * @returns Word 文档 Blob 对象
   */
  static async createWordDoc(title: string, content: string): Promise<Blob> {
    // 初始化表格头部
    const tableRows: TableRow[] = [
      this.createHeaderRow()
    ];

    // 解析剧本内容（处理换行、去空）
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0); // 过滤完全空的行

    let currentShotNum = 1; // 镜号自增计数器

    // 逐行解析剧本
    lines.forEach(line => {
      // 解析场景标题（格式：场景X：XXX）
      if (line.startsWith('场景') && line.includes('：')) {
        tableRows.push(this.createSceneRow(line));
        return; // 跳过后续解析，进入下一行
      }

      // 解析镜头描述（格式：镜头X：XXX 或 （镜头：XXX））
      if (line.includes('（镜头：') || line.startsWith('镜头')) {
        const visualContent = this.extractVisualContent(line);
        tableRows.push(this.createShotRow(currentShotNum, visualContent));
        currentShotNum++;
        return;
      }

      // 解析角色对白（格式：角色名：对白内容）
      if (line.includes('：') && !line.startsWith('场景')) {
        const { character, dialogue } = this.extractDialogue(line);
        tableRows.push(this.createDialogueRow(character, dialogue));
        return;
      }

      // 其他内容（如备注、说明）统一作为补充信息行
      tableRows.push(this.createSupplementRow(line));
    });

    // 构建完整 Word 文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 文档标题
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ 
                text: title, 
                bold: true, 
                size: 36, 
                font: "Microsoft YaHei",
                spacing: { after: 20 }
              }),
            ],
            spacing: { after: 400 } // 标题下方留空
          }),
          // 剧本表格
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
            borders: this.createTableBorders(), // 表格外边框
            style: {
              tableLayout: "fixed" // 固定列宽，避免内容挤压
            }
          })
        ],
      }],
    });

    return await Packer.toBlob(doc);
  }

  /**
   * 创建表格头部行
   */
  private static createHeaderRow(): TableRow {
    return new TableRow({
      children: [
        this.createHeaderCell("镜号", 8),
        this.createHeaderCell("画面内容与动作描写 (Visuals)", 42),
        this.createHeaderCell("角色", 12),
        this.createHeaderCell("对白 (Dialogue)", 28),
        this.createHeaderCell("音效/BGM", 10),
      ],
      height: { value: 400, type: "dxa" } // 表头高度
    });
  }

  /**
   * 创建场景标题行（跨5列）
   * @param sceneText 场景文本（如：场景1：雨夜别墅）
   */
  private static createSceneRow(sceneText: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          colSpan: 5,
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: sceneText, 
                  bold: true, 
                  size: 22, 
                  color: "DC2626", // 红色突出
                  font: "Microsoft YaHei" 
                })
              ],
              alignment: AlignmentType.LEFT,
              spacing: { before: 200, after: 200 }
            })
          ],
          shading: { fill: "F0F9FF" }, // 浅蓝色背景
          margins: { top: 150, bottom: 150, left: 200, right: 100 },
          verticalAlign: VerticalAlign.CENTER
        })
      ]
    });
  }

  /**
   * 创建镜头行（包含镜号、画面描述）
   * @param shotNum 镜号
   * @param visualContent 画面内容
   */
  private static createShotRow(shotNum: number, visualContent: string): TableRow {
    return new TableRow({
      children: [
        this.createDataCell(shotNum.toString().padStart(2, '0'), true), // 镜号补零（01、02）
        this.createDataCell(visualContent),
        this.createDataCell("——"), // 空角色占位
        this.createDataCell("——"), // 空对白占位
        this.createDataCell("Ambient"), // 默认环境音
      ],
      height: { value: 300, type: "dxa" }
    });
  }

  /**
   * 创建对白行（包含角色、对白、音效）
   * @param character 角色名
   * @param dialogue 对白内容
   */
  private static createDialogueRow(character: string, dialogue: string): TableRow {
    return new TableRow({
      children: [
        this.createDataCell(""), // 空镜号
        this.createDataCell(""), // 空画面描述
        this.createDataCell(character, true), // 角色名加粗
        this.createDataCell(dialogue, false, true), // 对白斜体
        this.createDataCell("VO"), // 人声对白音效
      ],
      height: { value: 250, type: "dxa" }
    });
  }

  /**
   * 创建补充信息行（跨5列）
   * @param supplementText 补充文本（如备注、说明）
   */
  private static createSupplementRow(supplementText: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          colSpan: 5,
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: `【补充说明】${supplementText}`, 
                  size: 16, 
                  color: "6B7280", // 灰色
                  font: "Microsoft YaHei" 
                })
              ],
              alignment: AlignmentType.LEFT,
              spacing: { before: 100, after: 100 }
            })
          ],
          margins: { top: 50, bottom: 50, left: 200 },
          verticalAlign: VerticalAlign.CENTER
        })
      ]
    });
  }

  /**
   * 创建表头单元格
   * @param text 单元格文本
   * @param width 列宽占比（百分比）
   */
  private static createHeaderCell(text: string, width: number): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({ 
          children: [
            new TextRun({ 
              text, 
              bold: true, 
              color: "FFFFFF", 
              size: 18, 
              font: "Microsoft YaHei" 
            })
          ],
          alignment: AlignmentType.CENTER 
        })
      ],
      shading: { fill: "2563EB" }, // 蓝色表头背景
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      borders: this.createCellBorders()
    });
  }

  /**
   * 创建数据单元格
   * @param text 单元格文本
   * @param isBold 是否加粗
   * @param isItalic 是否斜体
   */
  private static createDataCell(text: string, isBold: boolean = false, isItalic: boolean = false): TableCell {
    return new TableCell({
      children: [
        new Paragraph({ 
          children: [
            new TextRun({ 
              text: text || "——", // 空内容默认占位符
              size: 18, 
              bold: isBold, 
              italic: isItalic, 
              font: "Microsoft YaHei",
              break: "all" // 强制换行，避免英文/数字溢出
            })
          ],
          spacing: { before: 80, after: 80 },
          wrap: true // 自动换行
        })
      ],
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      borders: this.createCellBorders()
    });
  }

  /**
   * 创建表格外边框样式
   */
  private static createTableBorders(): TableBorders {
    return {
      top: { style: BorderStyle.SINGLE, size: 2, color: "2563EB" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "2563EB" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "2563EB" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "2563EB" },
    };
  }

  /**
   * 创建单元格边框样式
   */
  private static createCellBorders(): TableBorders {
    return {
      left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    };
  }

  /**
   * 提取镜头画面内容（清洗文本）
   * @param line 原始文本行
   */
  private static extractVisualContent(line: string): string {
    return line
      .replace(/（镜头：/g, '')
      .replace(/镜头\d+：/g, '')
      .replace(/）/g, '')
      .replace(/【.*?】/g, '') // 过滤备注括号内容
      .trim() || "无具体画面描述";
  }

  /**
   * 提取角色和对白（处理特殊角色名）
   * @param line 原始文本行
   */
  private static extractDialogue(line: string): { character: string; dialogue: string } {
    const colonIndex = line.indexOf('：'); // 只取第一个冒号
    if (colonIndex === -1) {
      return { character: "未知角色", dialogue: line };
    }

    const character = line.slice(0, colonIndex).trim() || "未知角色";
    const dialogue = line.slice(colonIndex + 1).trim() || "无对白";
    return { character, dialogue };
  }

  /**
   * 下载 Blob 文件（优化兼容性）
   * @param blob 文件 Blob 对象
   * @param filename 下载文件名
   */
  static downloadBlob(blob: Blob, filename: string): void {
    // 处理文件名后缀
    const fileExt = filename.endsWith('.docx') ? '' : '.docx';
    const finalFilename = `${filename}${fileExt}`;

    // 兼容不同浏览器
    if (window.navigator.msSaveOrOpenBlob) {
      // IE/Edge 兼容
      window.navigator.msSaveOrOpenBlob(blob, finalFilename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalFilename;
    link.style.display = "none";
    document.body.appendChild(link);
    
    // 触发下载
    link.click();
    
    // 清理资源
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
