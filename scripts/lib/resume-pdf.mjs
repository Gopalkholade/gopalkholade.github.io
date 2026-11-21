import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import PDFDocument from 'pdfkit';

const COLORS = {
  accent: '#10b981',
  ink: '#18181b',
  muted: '#52525b',
  rule: '#d4d4d8',
};

export async function generateResumePdf({ profile, experiences, categorizedSkills, projects }, outputPath) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, right: 52, bottom: 52, left: 52 },
    bufferPages: true,
    info: {
      Title: `${profile.name || 'Resume'} — Resume`,
      Author: profile.name || 'Portfolio',
      Subject: 'Professional resume',
    },
  });
  const output = createWriteStream(outputPath);
  const outputFinished = finished(output);
  doc.pipe(output);

  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  function ensureSpace(height) {
    if (doc.y + height > bottomLimit) doc.addPage();
  }

  function addBodyText(value, options = {}) {
    if (!value) return;
    const text = String(value);
    const font = options.font || 'Helvetica';
    const fontSize = options.fontSize || 9;
    const width = options.width || contentWidth;
    doc.font(font).fontSize(fontSize);
    const height = doc.heightOfString(text, {
      width,
      lineGap: options.lineGap ?? 2,
      paragraphGap: options.paragraphGap ?? 0,
      indent: options.indent,
      hanging: options.hanging,
      bullet: options.bullet,
    });
    ensureSpace(height + 2);
    doc.fillColor(options.color || COLORS.ink).text(text, {
      width,
      lineGap: options.lineGap ?? 2,
      paragraphGap: options.paragraphGap ?? 0,
      indent: options.indent,
      hanging: options.hanging,
      bullet: options.bullet,
      link: options.link,
    });
    doc.moveDown(options.after ?? 0.35);
  }

  function addSectionHeading(title) {
    ensureSpace(32);
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent).text(title.toUpperCase());
    doc.moveDown(0.35);
  }

  doc.rect(0, 0, doc.page.width, 7).fill(COLORS.accent);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(25).fillColor(COLORS.ink).text(profile.name || 'Resume');
  doc.moveDown(0.2);
  if (profile.headline) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.muted).text(profile.headline);
    doc.moveDown(0.5);
  }

  const contact = [
    profile.location,
    profile.email,
    profile.githubUrl ? 'GitHub' : '',
    profile.linkedinUrl ? 'LinkedIn' : '',
  ].filter(Boolean);

  if (contact.length > 0) {
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
    doc.text(contact.join('  |  '), { width: contentWidth, lineGap: 2 });
    doc.moveDown(0.7);
  }

  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(0.7)
    .strokeColor(COLORS.rule)
    .stroke();
  doc.moveDown(0.3);

  if (profile.bio) {
    addSectionHeading('Summary');
    addBodyText(profile.bio, { fontSize: 9.5, after: 0.4 });
  }

  const skillEntries = Object.entries(categorizedSkills).filter(
    ([, skills]) => Array.isArray(skills) && skills.length > 0,
  );
  if (skillEntries.length > 0) {
    addSectionHeading('Skills');
    for (const [key, skills] of skillEntries) {
      const label = categoryTaxonomyTitle(key);
      addBodyText(`${label}: ${skills.join(', ')}`, { fontSize: 8.5, after: 0.3 });
    }
  }

  if (experiences.length > 0) {
    addSectionHeading('Professional Experience');
    const orderedExperiences = [...experiences].sort((a, b) => (a.order || 99) - (b.order || 99));
    for (const experience of orderedExperiences) {
      ensureSpace(45);
      const dates = [experience.startDate, experience.isCurrent ? 'Present' : experience.endDate]
        .filter(Boolean)
        .join(' — ');
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(experience.role || 'Role');
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.accent)
        .text([experience.company, experience.location].filter(Boolean).join('  |  '));
      if (dates) {
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(dates);
      }
      doc.moveDown(0.25);
      if (experience.summary) addBodyText(experience.summary, { fontSize: 8.5, after: 0.2 });
      for (const achievement of experience.achievements || []) {
        addBodyText(achievement, {
          fontSize: 8.2,
          color: COLORS.muted,
          bullet: { indent: 10 },
          indent: 10,
          hanging: 3,
          after: 0.15,
        });
      }
      doc.moveDown(0.45);
    }
  }

  if (projects.length > 0) {
    addSectionHeading('Selected Projects');
    for (const project of projects) {
      ensureSpace(36);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink)
        .text(project.title || project.name || 'Project');
      if (project.techStack?.length) {
        addBodyText(project.techStack.join(', '), { fontSize: 8, color: COLORS.muted, after: 0.15 });
      }
      if (project.description) addBodyText(project.description, { fontSize: 8.5, after: 0.15 });
      if (project.repoUrl) {
        addBodyText(project.repoUrl, {
          fontSize: 8,
          color: COLORS.accent,
          link: project.repoUrl,
          after: 0.3,
        });
      }
    }
  }

  if (profile.education?.institution) {
    addSectionHeading('Education');
    addBodyText(
      [profile.education.degree, profile.education.institution, profile.education.duration]
        .filter(Boolean)
        .join('  |  '),
      { fontSize: 8.5 },
    );
  }

  if (Array.isArray(profile.certifications) && profile.certifications.length > 0) {
    addSectionHeading('Certifications');
    for (const certification of profile.certifications) {
      addBodyText(certification, {
        fontSize: 8.5,
        bullet: { indent: 10 },
        indent: 10,
        hanging: 3,
        after: 0.15,
      });
    }
  }

  const pageRange = doc.bufferedPageRange();
  for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
    doc.switchToPage(pageRange.start + pageIndex);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text(`${profile.name || 'Resume'}  |  ${pageIndex + 1} / ${pageRange.count}`, 52, doc.page.height - 34, {
        width: contentWidth,
        align: 'right',
        lineBreak: false,
      });
  }

  doc.end();
  await outputFinished;
}

function categoryTaxonomyTitle(key) {
  const titles = {
    languages: 'Programming & Query Languages',
    dataAnalytics: 'Data Analytics & Engineering',
    aiAndML: 'Machine Learning & Generative AI',
    toolsAndCloud: 'Developer Tools & Cloud Infrastructure',
    domainCompetencies: 'Domain Competencies',
  };
  return titles[key] || key;
}
