const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = require('docx');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const emblemPngPath = path.join(__dirname, '../../assets/emblem.png');

async function generatePDF({ title = 'OFFICIAL ADVISORY', content = '' }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 54, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const currentDate = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      // ----------------------------------------------------
      // TOP CENTER: OFFICIAL STATE EMBLEM OF INDIA & HEADER
      // ----------------------------------------------------
      const centerX = doc.page.width / 2;
      let startY = 94;

      if (fs.existsSync(emblemPngPath)) {
        doc.image(emblemPngPath, centerX - 30, 36, { width: 60 });
        startY = 125;
      } else {
        doc.save();
        doc.lineWidth(1.5);
        doc.strokeColor('#1e293b');
        doc.circle(centerX, 68, 14).stroke();
        doc.fillColor('#0f172a').fontSize(12).font('Times-Bold').text('🏛️', centerX - 6, 62, { lineBreak: false });
        doc.restore();
      }

      doc.font('Times-Bold');
      doc.fillColor('#0f172a');

      // 1. Government Name (Centered)
      doc.fontSize(14).text('GOVERNMENT OF INDIA', 54, startY, { align: 'center' });

      // 2. Department / Ministry Name
      const ministryTitle = title.toUpperCase().includes('ADVISORY')
        ? 'MINISTRY OF EXTERNAL AFFAIRS / MEA'
        : 'MINISTRY OF ELECTRONICS & INFORMATION TECHNOLOGY';
      doc.fontSize(11).text(ministryTitle, 54, startY + 20, { align: 'center' });

      // 3. Document Category (Underlined)
      const docType = title.toUpperCase().includes('ADVISORY') ? 'ADVISORY' : 'OFFICIAL REPORT';
      doc.fontSize(13).text(docType, 54, startY + 40, { align: 'center', underline: true });

      // 4. Date
      doc.fontSize(11).text(currentDate, 54, startY + 60, { align: 'center' });

      doc.y = startY + 85;

      doc.moveDown(2.0);

      // Divider Line
      doc.lineWidth(0.5).strokeColor('#94a3b8').moveTo(54, doc.y).lineTo(doc.page.width - 54, doc.y).stroke();
      doc.moveDown(1.5);

      // ----------------------------------------------------
      // BODY PARAGRAPHS (Official Numbered Indian Gov Layout)
      // ----------------------------------------------------
      doc.font('Times-Roman').fontSize(11).fillColor('#1e293b');

      const rawLines = content.split('\n').map(l => l.trim()).filter(Boolean);
      let paragraphCounter = 1;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];

        // Skip headers or slide markers
        if (line.startsWith('#') || /^Slide\s+\d+/i.test(line)) {
          const cleanHeading = line.replace(/^#{1,6}\s*/, '').replace(/^Slide\s+\d+:?\s*/i, '');
          if (cleanHeading && !cleanHeading.toLowerCase().includes('advisory')) {
            doc.moveDown(0.8);
            doc.font('Times-Bold').fontSize(12).fillColor('#0f172a').text(cleanHeading, { align: 'left' });
            doc.font('Times-Roman').fontSize(11).fillColor('#1e293b');
            doc.moveDown(0.4);
          }
          continue;
        }

        if (line.match(/^[\*\-•]?\s*Speaker Notes?:/i)) continue;

        // Numbered official paragraph formatting (1st paragraph unnumbered, subsequent paragraphs 2, 3, 4...)
        let formattedLine = line.replace(/^[-*•·]\s*/, '').replace(/\*\*/g, '').trim();
        if (!formattedLine) continue;

        let prefix = '';
        if (paragraphCounter > 1) {
          prefix = `${paragraphCounter}.  `;
        }
        paragraphCounter++;

        // Bold emphasis for key terms (e.g. "Mobile Numbers:", "Email:")
        const colonIdx = formattedLine.indexOf(':');
        if (colonIdx > 0 && colonIdx < 30) {
          const label = formattedLine.substring(0, colonIdx + 1);
          const rest = formattedLine.substring(colonIdx + 1).trim();

          doc.font('Times-Bold').text(prefix + label + ' ', { continued: true, align: 'justify' });
          doc.font('Times-Roman').text(rest, { align: 'justify' });
        } else {
          doc.font('Times-Roman').text(prefix + formattedLine, { align: 'justify', lineGap: 3 });
        }

        doc.moveDown(0.8);
      }

      // ----------------------------------------------------
      // OFFICIAL FOOTER DIVIDER & DOTS
      // ----------------------------------------------------
      doc.moveDown(1.5);
      doc.font('Times-Bold').fontSize(12).fillColor('#475569').text('*   *   *', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function generateDocx({ title = 'OFFICIAL ADVISORY', content = '' }) {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const emblemParagraphs = [];
  if (fs.existsSync(emblemPngPath)) {
    const emblemBuffer = fs.readFileSync(emblemPngPath);
    emblemParagraphs.push(
      new Paragraph({
        alignment: 'center',
        children: [
          new ImageRun({
            data: emblemBuffer,
            transformation: { width: 60, height: 80 },
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  const paragraphs = [
    ...emblemParagraphs,
    // 1. Government Name (Centered)
    new Paragraph({
      alignment: 'center',
      children: [
        new TextRun({
          text: 'GOVERNMENT OF INDIA',
          bold: true,
          size: 28, // 14pt
          font: 'Times New Roman',
          color: '0F172A',
        }),
      ],
      spacing: { after: 100 },
    }),

    // 2. Department / Ministry Name
    new Paragraph({
      alignment: 'center',
      children: [
        new TextRun({
          text: title.toUpperCase().includes('ADVISORY')
            ? 'MINISTRY OF EXTERNAL AFFAIRS / MEA'
            : 'MINISTRY OF ELECTRONICS & INFORMATION TECHNOLOGY',
          bold: true,
          size: 24, // 12pt
          font: 'Times New Roman',
          color: '334155',
        }),
      ],
      spacing: { after: 100 },
    }),

    // 3. Document Category (Underlined)
    new Paragraph({
      alignment: 'center',
      children: [
        new TextRun({
          text: title.toUpperCase().includes('ADVISORY') ? 'ADVISORY' : 'OFFICIAL REPORT',
          bold: true,
          underline: {},
          size: 26, // 13pt
          font: 'Times New Roman',
          color: '0F172A',
        }),
      ],
      spacing: { after: 100 },
    }),

    // 4. Date
    new Paragraph({
      alignment: 'center',
      children: [
        new TextRun({
          text: currentDate,
          bold: true,
          size: 22, // 11pt
          font: 'Times New Roman',
          color: '475569',
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  const rawLines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let paragraphCounter = 1;

  for (const line of rawLines) {
    if (line.startsWith('#') || /^Slide\s+\d+/i.test(line)) {
      const cleanHeading = line.replace(/^#{1,6}\s*/, '').replace(/^Slide\s+\d+:?\s*/i, '');
      if (cleanHeading && !cleanHeading.toLowerCase().includes('advisory')) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanHeading,
                bold: true,
                size: 24,
                font: 'Times New Roman',
                color: '0F172A',
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );
      }
      continue;
    }

    if (line.match(/^[\*\-•]?\s*Speaker Notes?:/i)) continue;

    let formattedLine = line.replace(/^[-*•·]\s*/, '').replace(/\*\*/g, '').trim();
    if (!formattedLine) continue;

    let prefix = '';
    if (paragraphCounter > 1) {
      prefix = `${paragraphCounter}.  `;
    }
    paragraphCounter++;

    const colonIdx = formattedLine.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const label = formattedLine.substring(0, colonIdx + 1);
      const rest = formattedLine.substring(colonIdx + 1).trim();

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: prefix + label + ' ', bold: true, size: 22, font: 'Times New Roman' }),
            new TextRun({ text: rest, size: 22, font: 'Times New Roman' }),
          ],
          spacing: { after: 160 },
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: prefix + formattedLine, size: 22, font: 'Times New Roman' }),
          ],
          spacing: { after: 160 },
        })
      );
    }
  }

  // Official Closing Footer Dots (* * *)
  paragraphs.push(
    new Paragraph({
      alignment: 'center',
      children: [
        new TextRun({ text: '*   *   *', bold: true, size: 24, font: 'Times New Roman', color: '64748B' }),
      ],
      spacing: { before: 300, after: 200 },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return await Packer.toBuffer(doc);
}

async function generatePptx({ title = 'Government Briefing Deck', content = '' }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10" x 5.625"

  // Color Palette (Official Government Vibe: Navy Blue, Emblem Gold, Slate & Pure White)
  const NAVY = '0A192F';        // Dark Navy Background
  const HEADER_NAVY = '002855'; // Official Header Banner
  const GOLD = 'D4AF37';        // Emblem Gold Accent
  const CARD_BG = '1E293B';     // Dark Slate Card Container
  const CARD_BORDER = '334155'; // Card Outline Border
  const TEXT_WHITE = 'FFFFFF';  // High-Contrast Title Text
  const TEXT_MUTED = '94A3B8';  // Subtitle & Footer Text
  const TEXT_BODY = 'E2E8F0';   // Body Bullet Text
  const GOLD_LIGHT = 'F59E0B';  // Accent Text

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // ----------------------------------------------------
  // SLIDE 1: OFFICIAL TITLE SLIDE (Government Vibe)
  // ----------------------------------------------------
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: NAVY };

  // Classification Banner Top
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10.0,
    h: 0.35,
    fill: { color: '1E3A8A' },
  });
  titleSlide.addText('OFFICIAL BRIEFING // FOR OFFICIAL USE ONLY // RESTRICTED ACCESS', {
    x: 0.5,
    y: 0.05,
    w: 9.0,
    h: 0.25,
    fontSize: 9,
    bold: true,
    color: GOLD,
    align: 'center',
    charSpacing: 2,
  });

  // State Emblem Image on Title Slide
  if (fs.existsSync(emblemPngPath)) {
    titleSlide.addImage({
      path: emblemPngPath,
      x: 4.6,
      y: 0.5,
      w: 0.8,
      h: 1.0,
    });
  }

  // Gold Accent Top Line
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 1.0,
    y: 1.6,
    w: 8.0,
    h: 0.04,
    fill: { color: GOLD },
  });

  // Title Box
  titleSlide.addText(title.toUpperCase(), {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.8,
    fontSize: 32,
    bold: true,
    color: TEXT_WHITE,
    align: 'center',
    breakLine: true,
  });

  // Subtitle
  titleSlide.addText('STRATEGIC COMMUNICATIONS & INCIDENT BRIEFING DECK', {
    x: 0.8,
    y: 3.6,
    w: 8.4,
    h: 0.6,
    fontSize: 14,
    bold: true,
    color: GOLD,
    align: 'center',
    charSpacing: 1.5,
  });

  // Gold Accent Bottom Line
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 3.5,
    y: 4.3,
    w: 3.0,
    h: 0.03,
    fill: { color: GOLD },
  });

  // Official Metadata Footer Box
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 1.5,
    y: 4.6,
    w: 7.0,
    h: 0.7,
    fill: { color: '0f172a' },
    line: { color: CARD_BORDER, width: 1 },
  });
  titleSlide.addText(`PREPARED BY: EXECUTIVE BRIEFING ENGINE  |  DATE: ${currentDate.toUpperCase()}  |  CLEARANCE: LEVEL-1`, {
    x: 1.6,
    y: 4.75,
    w: 6.8,
    h: 0.4,
    fontSize: 10,
    color: TEXT_MUTED,
    align: 'center',
  });

  // ----------------------------------------------------
  // PARSE CONTENT INTO SECTIONS / SLIDES
  // ----------------------------------------------------
  const rawSections = content
    .split(/(?=^#{1,3}\s+|^Slide\s+\d+:?)/mi)
    .map(s => s.trim())
    .filter(Boolean);

  const slideSections = rawSections.length > 0 ? rawSections : [content];
  const totalSlides = slideSections.length;

  for (let i = 0; i < totalSlides; i++) {
    const sectionText = slideSections[i];
    const lines = sectionText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    const slide = pptx.addSlide();
    slide.background = { color: NAVY };

    // Header Bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10.0,
      h: 0.85,
      fill: { color: HEADER_NAVY },
    });

    // Gold Line Accent Under Header
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0.83,
      w: 10.0,
      h: 0.04,
      fill: { color: GOLD },
    });

    // Emblem Image on Slide Header
    if (fs.existsSync(emblemPngPath)) {
      slide.addImage({
        path: emblemPngPath,
        x: 7.7,
        y: 0.12,
        w: 0.5,
        h: 0.6,
      });
    }

    // Extract Speaker Notes if present
    let speakerNotes = '';
    const cleanLines = [];

    for (const line of lines) {
      const notesMatch = line.match(/^[\*\-•]?\s*Speaker Notes?:?\s*(.*)$/i);
      if (notesMatch) {
        speakerNotes = notesMatch[1].replace(/\*+/g, '').trim();
      } else {
        cleanLines.push(line);
      }
    }

    if (speakerNotes) {
      slide.addNotes(speakerNotes);
    }

    if (!cleanLines.length) continue;

    // Header Title Parsing (supports Title: ..., Slide N: ..., ### Title)
    let rawTitle = cleanLines[0]
      .replace(/^#{1,6}\s*/, '')
      .replace(/^Slide\s+\d+:?\s*/i, '')
      .replace(/^Title:\s*/i, '')
      .trim();

    if (!rawTitle || rawTitle.length > 80) rawTitle = `Executive Briefing - Section ${i + 1}`;

    slide.addText(rawTitle.toUpperCase(), {
      x: 0.5,
      y: 0.18,
      w: 8.0,
      h: 0.5,
      fontSize: 18,
      bold: true,
      color: TEXT_WHITE,
    });

    // Classification Badge (Top Right)
    slide.addShape(pptx.ShapeType.rect, {
      x: 8.4,
      y: 0.22,
      w: 1.2,
      h: 0.35,
      fill: { color: '1E3A8A' },
      line: { color: GOLD, width: 1 },
    });
    slide.addText('OFFICIAL', {
      x: 8.4,
      y: 0.27,
      w: 1.2,
      h: 0.25,
      fontSize: 9,
      bold: true,
      color: GOLD,
      align: 'center',
    });

    // Card Container Body
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 1.1,
      w: 9.0,
      h: 4.0,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
    });

    // Extract Bullet Points from cleanLines into a flat textRuns array
    const bodyLines = cleanLines.slice(1);
    const textRuns = [];

    for (const bLine of bodyLines) {
      const cleanBullet = bLine.replace(/^[-*•·]\s*/, '').replace(/\*\*/g, '').trim();
      if (!cleanBullet) continue;

      if (bLine.startsWith('#')) {
        textRuns.push({
          text: cleanBullet.toUpperCase() + '\n',
          options: { fontSize: 14, bold: true, color: GOLD_LIGHT, spaceBefore: 8 },
        });
      } else {
        const colonIdx = cleanBullet.indexOf(':');
        if (colonIdx > 0 && colonIdx < 35) {
          const label = cleanBullet.substring(0, colonIdx + 1);
          const rest = cleanBullet.substring(colonIdx + 1).trim();

          textRuns.push({
            text: label + ' ',
            options: { bullet: { type: 'bullet', code: '2022' }, fontSize: 13, bold: true, color: GOLD_LIGHT },
          });
          textRuns.push({
            text: rest + '\n',
            options: { fontSize: 13, bold: false, color: TEXT_BODY, breakLine: true },
          });
        } else {
          textRuns.push({
            text: cleanBullet + '\n',
            options: { bullet: { type: 'bullet', code: '2022' }, fontSize: 13, color: TEXT_BODY, breakLine: true },
          });
        }
      }
    }

    if (textRuns.length > 0) {
      slide.addText(textRuns, {
        x: 0.8,
        y: 1.3,
        w: 8.4,
        h: 3.6,
        valign: 'top',
      });
    } else {
      // Fallback if section body is plain text
      const cleanBody = cleanLines.slice(1).join('\n').replace(/\*\*/g, '');
      slide.addText(cleanBody.substring(0, 450), {
        x: 0.8,
        y: 1.3,
        w: 8.4,
        h: 3.6,
        fontSize: 13,
        color: TEXT_BODY,
        valign: 'top',
      });
    }

    // Footer Bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 5.25,
      w: 10.0,
      h: 0.375,
      fill: { color: '030712' },
    });

    slide.addText(`GOVERNMENT COMMUNICATIONS PLATFORM  |  OFFICIAL BRIEFING DECK  |  SLIDE ${i + 1} OF ${totalSlides}`, {
      x: 0.5,
      y: 5.32,
      w: 9.0,
      h: 0.25,
      fontSize: 9,
      color: TEXT_MUTED,
      align: 'center',
    });
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer;
}

module.exports = {
  generatePDF,
  generateDocx,
  generatePptx,
};
