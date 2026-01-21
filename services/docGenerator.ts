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
  TableBorders,
  ShadingType,
} from "docx";

export class DocGenerator {
  /**
   * 创建动画剧本 Word 文档
   * @param title 文档标题
   * @param content 剧本纯文本内容
   * @param customStyles 自定义样式（可选）
   * @returns Word 文档 Blob 对象
   */
  static async createWordDoc(
    title: string,
    content: string,
    customStyles?: {
      titleColor?: string;
      sceneColor?: string;
      headerBgColor?: string;
      sceneBgColor?: string;
    }
  ): Promise<Blob> {
    // 合并默认样式与自定义样式
    const styles = {
      titleColor: "#DC2626",
      sceneColor: "#DC2626",
      headerBgColor: "#2563EB",
      sceneBgColor: "#F0F9FF",
      ...customStyles,
    };

    // 初始化表格头部
    const tableRows: TableRow[] = [this.createHeaderRow(styles.headerBgColor)];

    // 解析剧本内容（处理换行、去空，保留有意义的空行）
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 || line === ""); // 保留空行用于分隔

    let currentShotNum = 1; // 镜号自增计数器
    let lastLineType: "scene" | "shot" | "dialogue" | "supplement" | "" = ""; // 记录上一行类型，避免重复

    // 逐行解析剧本
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过连续空行
      if (line === "" && lastLineType !== "") {
        continue;
      }

      // 解析场景标题（支持多种格式：场景X、场景 X、SCENE X 等）
      const sceneReg = /^(场景|SCENE)\s*(\d+|\w+)\s*：.+/i;
      if (sceneReg.test(line)) {
        const formattedScene = this.formatSceneText(line);
        tableRows.push(this.createSceneRow(formattedScene, styles.sceneColor, styles.sceneBgColor));
        lastLineType = "scene";
        currentShotNum = 1; // 场景切换时重置镜号
        continue;
      }

      // 解析镜头描述（支持多种格式：镜头X、镜头 X、SHOT X 等）
      const shotReg = /^(镜头|SHOT)\s*(\d+|\w+)\s*：.+/i;
      if (shotReg.test(line) || line.includes('（镜头：')) {
        const visualContent = this.extractVisualContent(line);
        // 避免连续镜头行重复
        if (lastLineType !== "shot" || visualContent !== tableRows[tableRows.length - 1].children[1]?.children[0]?.children[0]?.text) {
          tableRows.push(this.createShotRow(currentShotNum, visualContent));
          currentShotNum++;
          lastLineType = "shot";
        }
        continue;
      }

      // 解析角色对白（支持：角色名：、角色名:、「角色名」：等格式）
      const dialogueReg = /^([^：:]+)[：:].+/;
      if (dialogueReg.test(line) && !line.startsWith('场景') && !line.startsWith('镜头')) {
        const { character, dialogue } = this.extractDialogue(line);
        // 处理多行对白（合并后续空行后的对白内容）
        let fullDialogue = dialogue;
        let j = i + 1;
        while (j < lines.length && lines[j] !== "" && !sceneReg.test(lines[j]) && !shotReg.test(lines[j]) && !dialogueReg.test(lines[j])) {
          fullDialogue += "\n" + lines[j].trim();
          j++;
        }
        i = j - 1; // 跳过已合并的行

        tableRows.push(this.createDialogueRow(character, fullDialogue));
        lastLineType = "dialogue";
        continue;
      }

      // 处理纯动作描述（非场景、非镜头、非对白的文本）
      if (line !== "" && !line.startsWith('【补充说明】')) {
        tableRows.push(this.createActionRow(line));
        lastLineType = "supplement";
        continue;
      }

      // 其他内容（如备注、说明）
      if (line.startsWith('【补充说明】')) {
        tableRows.push(this.createSupplementRow(line));
        lastLineType = "supplement";
        continue;
      }
    }

    // 构建完整 Word 文档
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440, // 2cm
              bottom: 1440,
              left: 1800, // 2.5cm
              right: 1800,
            },
          },
        },
        children: [
          // 文档标题（优化样式）
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 36,
                font: "Microsoft YaHei",
                color: styles.titleColor,
                spacing: { after: 20 },
              }),
            ],
            spacing: { after: 400 },
          }),
          // 剧本表格（优化列宽和布局）
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
            borders: this.createTableBorders(),
            style: {
              tableLayout: "fixed",
              cellSpacing: 0,
            },
          }),
        ],
      }],
    });

    // 生成 Blob（兼容不同浏览器）
    try {
      return await Packer.toBlob(doc);
    } catch (error) {
      console.error("生成 Word 文档失败：", error);
      throw new Error("Word 文档生成失败，请重试");
    }
  }

  /**
   * 创建表格头部行（支持自定义背景色）
   */
  private static createHeaderRow(headerBgColor: string): TableRow {
    return new TableRow({
      children: [
        this.createHeaderCell("镜号", 8, headerBgColor),
        this.createHeaderCell("画面内容与动作描写 (Visuals)", 42, headerBgColor),
        this.createHeaderCell("角色", 12, headerBgColor),
        this.createHeaderCell("对白 (Dialogue)", 28, headerBgColor),
        this.createHeaderCell("音效/BGM", 10, headerBgColor),
      ],
      height: { value: 400, type: "dxa" },
    });
  }

  /**
   * 创建场景标题行（支持自定义颜色）
   */
  private static createSceneRow(sceneText: string, sceneColor: string, sceneBgColor: string): TableRow {
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
                  color: sceneColor,
                  font: "Microsoft YaHei",
                }),
              ],
              alignment: AlignmentType.LEFT,
              spacing: { before: 200, after: 200 },
            }),
          ],
          shading: { fill: sceneBgColor, type: ShadingType.SOLID },
          margins: { top: 150, bottom: 150, left: 200, right: 100 },
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: sceneBgColor },
          },
        }),
      ],
    });
  }

  /**
   * 创建镜头行
   */
  private static createShotRow(shotNum: number, visualContent: string): TableRow {
    return new TableRow({
      children: [
        this.createDataCell(shotNum.toString().padStart(2, '0'), true), // 镜号补零
        this.createDataCell(visualContent, false, false, true), // 画面描述支持换行
        this.createDataCell("——"),
        this.createDataCell("——"),
        this.createDataCell("Ambient"),
      ],
      height: { value: 300, type: "dxa" },
    });
  }

  /**
   * 创建对白行
   */
  private static createDialogueRow(character: string, dialogue: string): TableRow {
    return new TableRow({
      children: [
        this.createDataCell(""),
        this.createDataCell(""),
        this.createDataCell(character, true),
        this.createDataCell(dialogue, false, true, true), // 对白支持换行
        this.createDataCell("VO"),
      ],
      height: { value: 250, type: "dxa" },
    });
  }

  /**
   * 创建纯动作描述行（新增：单独的动作列展示）
   */
  private static createActionRow(actionText: string): TableRow {
    return new TableRow({
      children: [
        this.createDataCell(""),
        this.createDataCell(actionText, false, false, true), // 动作描述支持换行
        this.createDataCell("——"),
        this.createDataCell("——"),
        this.createDataCell("SFX"), // 动作音效默认值
      ],
      height: { value: 200, type: "dxa" },
    });
  }

  /**
   * 创建补充信息行
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
                  text: supplementText,
                  size: 16,
                  color: "#6B7280",
                  font: "Microsoft YaHei",
                  italic: true,
                }),
              ],
              alignment: AlignmentType.LEFT,
              spacing: { before: 100, after: 100 },
            }),
          ],
          margins: { top: 50, bottom: 50, left: 200 },
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: "#F9FAFB", type: ShadingType.SOLID },
        }),
      ],
    });
  }

  /**
   * 创建表头单元格（支持自定义背景色）
   */
  private static createHeaderCell(text: string, width: number, bgColor: string): TableCell {
    return new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: true,
              color: "#FFFFFF",
              size: 18,
              font: "Microsoft YaHei",
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
      ],
      shading: { fill: bgColor, type: ShadingType.SOLID },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      borders: this.createCellBorders(),
    });
  }

  /**
   * 创建数据单元格（支持自动换行和长文本处理）
   */
  private static createDataCell(
    text: string,
    isBold: boolean = false,
    isItalic: boolean = false,
    enableWrap: boolean = false
  ): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text || "——",
              size: 18,
              bold: isBold,
              italic: isItalic,
              font: "Microsoft YaHei",
              break: enableWrap ? "all" : undefined,
              noBreak: !enableWrap,
            }),
          ],
          spacing: { before: 80, after: 80 },
          wrap: enableWrap,
          alignment: enableWrap ? AlignmentType.LEFT : AlignmentType.CENTER,
        }),
      ],
      verticalAlign: VerticalAlign.TOP,
      margins: { top: 100, bottom: 100, left: 100, right: 100 },
      borders: this.createCellBorders(),
    });
  }

  /**
   * 创建表格外边框样式（优化颜色和粗细）
   */
  private static createTableBorders(): TableBorders {
    return {
      top: { style: BorderStyle.SINGLE, size: 2, color: "#2563EB" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "#2563EB" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "#2563EB" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "#2563EB" },
    };
  }

  /**
   * 创建单元格边框样式（浅色细边框，提升美观度）
   */
  private static createCellBorders(): TableBorders {
    return {
      left: { style: BorderStyle.SINGLE, size: 1, color: "#E2E8F0" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "#E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "#E2E8F0" },
      top: { style: BorderStyle.SINGLE, size: 1, color: "#E2E8F0" },
    };
  }

  /**
   * 格式化场景文本（统一格式：场景X：XXX）
   */
  private static formatSceneText(line: string): string {
    return line.replace(/^(场景|SCENE)\s*/i, '场景').replace(/\s*：/, '：');
  }

  /**
   * 提取镜头画面内容（增强清洗能力）
   */
  private static extractVisualContent(line: string): string {
    return line
      .replace(/（镜头：/g, '')
      .replace(/^(镜头|SHOT)\s*\d+\s*：/i, '')
      .replace(/）/g, '')
      .replace(/【.*?】/g, '')
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim() || "无具体画面描述";
  }

  /**
   * 提取角色和对白（支持更多格式）
   */
  private static extractDialogue(line: string): { character: string; dialogue: string } {
    // 处理带引号的角色名：「角色名」：、"角色名"：等
    line = line.replace(/^[「"『]([^「"『」"』]+)[」"』]\s*[：:]/, '$1：');

    const colonIndex = line.indexOf('：') !== -1 ? line.indexOf('：') : line.indexOf(':');
    if (colonIndex === -1) {
      return { character: "未知角色", dialogue: line };
    }

    const character = line.slice(0, colonIndex).trim() || "未知角色";
    const dialogue = line.slice(colonIndex + 1).trim() || "无对白";
    return { character, dialogue };
  }

  /**
   * 下载 Blob 文件（增强兼容性和用户体验）
   */
  static downloadBlob(blob: Blob, filename: string): void {
    // 处理文件名（去除特殊字符，避免下载失败）
    const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_');
    const fileExt = safeFilename.endsWith('.docx') ? '' : '.docx';
    const finalFilename = `${safeFilename}${fileExt}`;

    // 兼容 IE/Edge
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, finalFilename);
      return;
    }

    // 标准浏览器下载逻辑
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = finalFilename;
    link.style.display = "none";
    link.setAttribute("target", "_blank");
    document.body.appendChild(link);

    // 触发下载（解决部分浏览器不触发问题）
    setTimeout(() => {
      link.click();
      // 清理资源
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }, 0);
  }

  /**
   * 辅助方法：判断内容是否为空（支持多个空格/制表符）
   */
  private static isEmptyContent(text: string | undefined | null): boolean {
    return !text || text.trim().length === 0;
  }
}
