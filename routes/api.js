/* --------------  routes/api.js  -------------- */
const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

/* ---------- strict but non-zero scoring ---------- */
const QUAL_MAP = { phd: 35, masters: 15, bachelors: 20, other: 10 };
const SKILL_LIST = ['C', 'C++', 'Java', 'Python', 'Rust', 'Go', 'Kafka', 'Kubernetes'];
const PROJECT_KEYS = ['microservices', 'kafka', 'kubernetes', 'grpc', 'tensorflow', 'cuda', 'dynamoDB', 'redshift', 'istio', 'envoy'];
const HOBBY_KEYS = ['research', 'patent', 'conference', 'hackathon', 'open-source', 'mentoring', 'leadership', 'competition'];

function uniqCount(arr) { return new Set(arr).size; }

function calculateFormScore(qualification) {
  return QUAL_MAP[qualification.toLowerCase()] || 10;
}
function calculateSkillScore(skills) {
  const tokens = skills.split(',').map(s => s.trim());
  const hits = tokens.filter(t => SKILL_LIST.includes(t));
  return Math.max(hits.length * 5, 5); // floor 5, cap 40
}
function calculateProjectScore(projects) {
  const txt = projects.toLowerCase();
  const hits = PROJECT_KEYS.filter(k => txt.includes(k));
  return Math.max(uniqCount(hits) * 3, 5); // floor 5, cap 30
}
function calculateHobbyScore(hobbies) {
  const txt = hobbies.toLowerCase();
  const hits = HOBBY_KEYS.filter(k => txt.includes(k));
  return Math.max(uniqCount(hits) * 3, 5); // floor 5, cap 30
}

/* ==========  CANDIDATE ROUTES  ========== */

router.post('/resumes', express.json(), async (req, res) => {
  const { name, email, phone, address, university, field, year, qualification, internship, portfolio, softSkills, skills, projects, hobbies } = req.body;

  const formScore      = calculateFormScore(qualification);
  const skillScore     = calculateSkillScore(skills);
  const projectScore   = calculateProjectScore(projects);
  const hobbyScore     = calculateHobbyScore(hobbies);
  const totalScore     = formScore + skillScore + projectScore + hobbyScore;

  /* status thresholds: tough but fair */
  let status = 0; // pending
  if (totalScore >= 85) status = 1; // selected
  else if (totalScore < 65) status = 2; // rejected

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const pdf_filename = `${name.replace(/ /g, '_')}-${uniqueSuffix}.pdf`;
  const pdf_path = path.join('uploads', pdf_filename);

  try {
    const doc = new PDFDocument({ margin: 50 });
    doc.text(
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `Address: ${address}\n` +
      `University: ${university} | Field: ${field} | Year: ${year}\n` +
      `Qualification: ${qualification}\n` +
      `Internship: ${internship}\n` +
      `Portfolio: ${portfolio}\n` +
      `Soft Skills: ${softSkills}\n` +
      `Technical Skills: ${skills}\n` +
      `Projects Done: ${projects}\n` +
      `Hobbies: ${hobbies}\n\n` +
      `Total Score: ${totalScore}/100`
    );
    fs.mkdirSync(path.dirname(pdf_path), { recursive: true });
    doc.pipe(fs.createWriteStream(pdf_path));
    doc.end();

    const stmt = db.prepare(`INSERT INTO resumes
      (name,email,phone,address,university,field,year,qualification,internship,portfolio,softSkills,skills,projects,hobbies,score,status,pdf_path)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    stmt.run(name, email, phone, address, university, field, year, qualification, internship, portfolio, softSkills, skills, projects, hobbies, totalScore, status, pdf_path, function (err) {
      if (err) {
        fs.unlinkSync(pdf_path);
        return res.status(400).json({ error: 'A user with this name already exists.' });
      }
      res.json({ id: this.lastID, score: totalScore, status });
    });
    stmt.finalize();

  } catch (ioErr) {
    console.error(ioErr);
    res.status(500).json({ error: 'Server error while saving file.' });
  }
});

/* ---------- status check (no score shown) ---------- */
router.get('/status', (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  db.all('SELECT * FROM resumes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const found = rows.filter(r => r.name.toLowerCase().includes(name));
    res.json(found);
  });
});

/* all candidates for admin lists */
router.get('/all', (req, res) => {
  db.all('SELECT id, name, score, status FROM resumes ORDER BY score DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* ==========  ADMIN ROUTES  ========== */

router.post('/select', (req, res) => {
  db.serialize(() => {
    db.run('UPDATE resumes SET status=0');
    db.all('SELECT * FROM resumes ORDER BY score DESC', (err, rows) => {
      if (err || rows.length === 0) return res.json({ error: 'No resumes' });
      const best = rows[0];
      db.run('UPDATE resumes SET status=1 WHERE id=?', [best.id]);
      const others = rows.slice(1);
      const stmt = db.prepare('INSERT INTO rejected_stack (resume_id) VALUES (?)');
      others.forEach(r => stmt.run(r.id));
      stmt.finalize(() => res.json({ selected: best }));
    });
  });
});

router.get('/selected', (req, res) => {
  db.get('SELECT * FROM resumes WHERE status=1', (err, row) => {
    res.json(row || {});
  });
});

router.post('/restore', (req, res) => {
  db.get('SELECT resume_id FROM rejected_stack ORDER BY resume_id DESC LIMIT 1', (err, row) => {
    if (!row) return res.json({ error: 'Stack empty' });
    const rid = row.resume_id;
    db.run('DELETE FROM rejected_stack WHERE resume_id=?', [rid]);
    db.run('UPDATE resumes SET status=1 WHERE id=?', [rid]);
    db.get('SELECT * FROM resumes WHERE id=?', [rid], (err, r) => res.json(r));
  });
});

/* txt download */
router.get('/resume/:id/download', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resumes WHERE id=?', [id], (err, r) => {
    if (!r) return res.status(404).send('Not found');
    const text = `*************** RESUME ***************\n\n` +
      `Name: ${r.name}\nEmail: ${r.email}\nPhone: ${r.phone}\nAddress: ${r.address}\n` +
      `University: ${r.university} | Field: ${r.field} | Year: ${r.year}\n` +
      `Qualification: ${r.qualification}\nInternship: ${r.internship}\nPortfolio: ${r.portfolio}\nSoft Skills: ${r.softSkills}\n` +
      `Technical Skills: ${r.skills}\nProjects: ${r.projects}\nHobbies: ${r.hobbies}\n` +
      `Score: ${r.score}/100\nStatus: ${r.status === 1 ? 'SELECTED' : r.status === 2 ? 'REJECTED' : 'PENDING'}\n`;
    const file = path.join(__dirname, '..', 'tmp', `${r.name}_resume.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    res.download(file, () => fs.unlinkSync(file));
  });
});

/* formal PDF */
router.get('/generate-pdf/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resumes WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).send('DB error');
    if (!row) return res.status(404).send('Resume not found');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const filename = `${row.name.replace(/ /g, '_')}_Resume.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.rect(doc.x - 10, doc.y - 10, 520, 100).fill('#f4f4f4');
    doc.fillColor('#000').fontSize(24).font('Helvetica-Bold').text(row.name, 60, 50);
    doc.fontSize(11).font('Helvetica')
       .text(`Email: ${row.email}`, 60, 80)
       .text(`Phone: ${row.phone}`, 60, 95)
       .text(`Address: ${row.address}`, 60, 110);
    doc.moveDown(3);

    const section = (title, text, color) => {
      doc.save();
      doc.fillColor(color).fontSize(14).font('Helvetica-Bold').text(title, 50);
      const y = doc.y;
      doc.rect(50, y + 2, 500, 1).fill(color);
      doc.fillColor('#000').fontSize(11).font('Helvetica').text(text || 'N/A', 50, y + 8);
      doc.moveDown(2);
      doc.restore();
    };

    section('UNIVERSITY', `${row.university} | ${row.field} | ${row.year}`, '#0057b8');
    section('QUALIFICATION', row.qualification, '#0057b8');
    section('INTERNSHIP', row.internship, '#0057b8');
    section('PORTFOLIO', row.portfolio, '#0057b8');
    section('SOFT SKILLS', row.softSkills, '#0057b8');
    section('TECHNICAL SKILLS', row.skills, '#0057b8');
    section('PROJECTS DONE', row.projects, '#0057b8');
    section('HOBBIES', row.hobbies, '#0057b8');
    section('TOTAL SCORE', `${row.score}/100`, '#0057b8');

    doc.end();
  });
});

module.exports = router;