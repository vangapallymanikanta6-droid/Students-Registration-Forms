require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 8000);
const ROOT_DIR = path.join(__dirname, '../frontend');
const DB_NAME = process.env.DB_NAME || 'businesslabs';

if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  throw new Error('DB_NAME must contain only letters, numbers, and underscores.');
}

const dbConfig = {
  host: process.env.DB_HOST || 'mysql-3d5eeed-vangapallymanikanta6-2948.k.aivencloud.com',
  port: Number(process.env.DB_PORT || 12685),
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'default_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ssl: process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1'
    ? { rejectUnauthorized: false }
    : false
};

const pool = mysql.createPool(dbConfig);

const parseInterests = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
    } catch (error) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeUser = (row) => {
  if (!row) return null;

  const user = { ...row };

  if (user.aadhaarFileName) {
    user.aadhaarDataUrl = `/uploads/${user.aadhaarFileName}`;
  }

  if (typeof user.interests === 'string') {
    try {
      user.interests = JSON.parse(user.interests);
    } catch (error) {
      user.interests = [];
    }
  }

  return user;
};

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
      return;
    }

    cb(new Error('Only PDF files are allowed.'));
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT_DIR));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get('/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');

  res.json({
    ok: true,
    database: 'mysql'
  });
}));

app.get('/api/users', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM users ORDER BY id ASC'
  );

  res.json({
    success: true,
    users: rows.map(normalizeUser)
  });
}));

app.post('/api/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({
      message: 'Email and password are required.'
    });
    return;
  }

  const [rows] = await pool.execute(
    `
    SELECT *
    FROM users
    WHERE LOWER(email) = LOWER(?)
    AND password = ?
    `,
    [
      String(email).trim(),
      String(password)
    ]
  );

  if (!rows.length) {
    res.status(401).json({
      message: 'Invalid email or password.'
    });
    return;
  }

  res.json({
    success: true,
    user: normalizeUser(rows[0])
  });
}));

app.post(
  '/api/register',
  upload.single('aadhaarFile'),
  asyncRoute(async (req, res) => {
    const fields = req.body || {};

    const email = String(fields.email || '').trim();
    const name = String(fields.name || '').trim();
    const password = String(fields.password || '').trim();

    if (!email || !name || !password) {
      res.status(400).json({
        message: 'All required fields are required.'
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        message: 'Please upload your document PDF.'
      });
      return;
    }

    const [existing] = await pool.execute(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER(?)
      `,
      [email]
    );

    if (existing.length) {
      res.status(409).json({
        message: 'This email is already registered.'
      });
      return;
    }

    const ext = path
      .extname(req.file.originalname || '.pdf')
      .toLowerCase();

    const generatedFilename =
      `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

    try {
      const [result] = await pool.execute(
        `
        INSERT INTO users
        (
          name,
          email,
          password,
          dob,
          gender,
          qualification,
          className,
          subject,
          marks,
          interests,
          role,
          aadhaarFileName,
          aadhaarOriginalName
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', ?, ?)
        `,
        [
          name,
          email,
          password,
          fields.dob || null,
          fields.gender || null,
          fields.qualification || null,
          fields.className || null,
          fields.subject || null,
          fields.marks !== '' &&
          fields.marks !== undefined &&
          fields.marks !== null
            ? Number(fields.marks)
            : null,
          JSON.stringify(parseInterests(fields.interests)),
          generatedFilename,
          req.file.originalname
        ]
      );

      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        user: normalizeUser(rows[0])
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message: 'This email is already registered.'
        });
        return;
      }

      throw error;
    }
  })
);

app.put(
  '/api/users/:id',
  upload.single('aadhaarFile'),
  asyncRoute(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      res.status(400).json({
        message: 'Invalid user id.'
      });
      return;
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    const existingUser = users[0];

    if (!existingUser) {
      res.status(404).json({
        message: 'User not found.'
      });
      return;
    }

    const nextName =
      req.body.name ?? existingUser.name;

    const nextPassword =
      req.body.password ?? existingUser.password;

    const nextDob =
      req.body.dob || null;

    const nextGender =
      req.body.gender ?? existingUser.gender;

    const nextQualification =
      req.body.qualification ?? existingUser.qualification;

    const nextClassName =
      req.body.className ?? existingUser.className;

    const nextSubject =
      req.body.subject ?? existingUser.subject;

    const nextMarks =
      req.body.marks !== undefined &&
      req.body.marks !== ''
        ? Number(req.body.marks)
        : existingUser.marks;

    const nextInterests = JSON.stringify(
      parseInterests(
        req.body.interests ?? existingUser.interests
      )
    );

    let newFilename = null;
    let newOriginalName = null;

    if (req.file) {
      const ext = path
        .extname(req.file.originalname || '.pdf')
        .toLowerCase();

      newFilename =
        `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

      newOriginalName = req.file.originalname;
    }

    await pool.execute(
      `
      UPDATE users
      SET
        name = ?,
        password = ?,
        dob = ?,
        gender = ?,
        qualification = ?,
        className = ?,
        subject = ?,
        marks = ?,
        interests = ?,
        aadhaarFileName = COALESCE(?, aadhaarFileName),
        aadhaarOriginalName = COALESCE(?, aadhaarOriginalName)
      WHERE id = ?
      `,
      [
        nextName,
        nextPassword,
        nextDob,
        nextGender,
        nextQualification,
        nextClassName,
        nextSubject,
        nextMarks,
        nextInterests,
        newFilename,
        newOriginalName,
        userId
      ]
    );

    const [updated] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      user: normalizeUser(updated[0])
    });
  })
);

app.delete(
  '/api/users/:id',
  asyncRoute(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      res.status(400).json({
        message: 'Invalid user id.'
      });
      return;
    }

    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (!users[0]) {
      res.status(404).json({
        message: 'User not found.'
      });
      return;
    }

    await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true
    });
  })
);

app.post(
  '/api/forgot-password',
  asyncRoute(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({
        message: 'Email and new password are required.'
      });
      return;
    }

    const [result] = await pool.execute(
      `
      UPDATE users
      SET password = ?
      WHERE LOWER(email) = LOWER(?)
      `,
      [
        String(password),
        String(email).trim()
      ]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({
        message: 'No account found for this email.'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Password updated successfully.'
    });
  })
);

app.use((err, _req, res, _next) => {
  if (
    err &&
    (
      err.code === 'LIMIT_FILE_SIZE' ||
      err.message === 'Only PDF files are allowed.'
    )
  ) {
    res.status(400).json({
      message: err.message || 'Invalid file upload.'
    });
    return;
  }

  console.error(err);

  res.status(500).json({
    message: 'Server error'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Server running locally on http://localhost:${PORT}`
    );
  });
}

module.exports = app;