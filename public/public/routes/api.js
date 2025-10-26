const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');

const SKILL_LIST = ['c','c++','java','python','html','css','sql'];

function calculateScore(qualification, skills, experience) {
  let score = 0;
  const q = qualification.toLowerCase();
  if (q === 'phd') score += 40;
  else if (q === 'masters') score += 30;
  else if (q === 'bachelors') score += 20;
  else score += 10;

  let skillPoints = 0;
  const has = skills.toLowerCase();
  SKILL_LIST.forEach(s => { if (has.includes(s)) skillPoints += 10; });
  if (skillPoints > 30) skillPoints = 30;
  score += skillPoints;

  let expPoints = experience * 5;
  if (expPoints > 30) expPoints = 30;
  score += expPoints;
  return score > 100 ? 100 : score;
}

// ---------- candidate ----------
router.post('/resumes', (req, res) => {
  const { name, email, phone, qualification, skills, experience } = req.body;
  const score = calculateScore(qualification, skills, Number(experience));
  const stmt = db.prepare(`INSERT INTO resumes
      (name,email,phone,qualification,skills,experience,score,status)
      VALUES (?,?,?,?,?,?,?,0)`);
  stmt.run(name, email, phone, qualification, skills, experience, score, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    const id = this.lastID;
    res.json({ id, score });
  });
  stmt.finalize();
});

router.get('/status', (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  db.all('SELECT * FROM resumes', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const found = rows.filter(r => r.name.toLowerCase().includes(name));
    res.json(found);
  });
});

// ---------- admin ----------
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

// ---------- download ----------
router.get('/resume/:id/download', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM resumes WHERE id=?', [id], (err, r) => {
    if (!r) return res.status(404).send('Not found');
    const text = `*************** RESUME ***************\n\n` +
      `Name: ${r.name}\nEmail: ${r.email}\nPhone: ${r.phone}\n` +
      `Qualification: ${r.qualification}\nSkills: ${r.skills}\n` +
      `Experience: ${r.experience} years\nScore: ${r.score}\n` +
      `Status: ${r.status === 1 ? 'SELECTED' : 'REJECTED'}\n`;
    const file = path.join(__dirname, '..', 'tmp', `${r.name}_resume.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    res.download(file, () => fs.unlinkSync(file));
  });
});

module.exports = router;