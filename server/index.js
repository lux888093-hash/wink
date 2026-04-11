require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  ensureStoreFile,
  seedDemoData,
  createOneTimeCode,
  consumeOneTimeCode,
  getSessionExperience
} = require('./services/store');
const { hasWechatCredentials, generateMiniProgramCode } = require('./services/wechat');

const app = express();
const port = Number(process.env.PORT || 3100);
const pagePath = 'pages/redeem/index';

ensureStoreFile();

app.use(cors());
app.use(express.json({ strict: false }));
app.use('/qrcodes', express.static(path.join(__dirname, 'public', 'qrcodes')));
app.use('/preview', express.static(path.join(__dirname, 'public', 'preview')));
app.use(
  '/preview-assets/audio',
  express.static(path.join(__dirname, '..', 'miniprogram', 'assets', 'audio'))
);

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, 'body')) {
    res.status(400).json({
      ok: false,
      code: 'INVALID_JSON_PAYLOAD'
    });
    return;
  }

  next(error);
});

function respondError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({
    ok: false,
    code: error.message || 'INTERNAL_ERROR',
    meta: error.meta || null
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'hongjiu-curator-server',
    port
  });
});

app.post('/api/admin/dev/reset', (_req, res) => {
  const { code, store } = seedDemoData();
  const wine = store.wines[0];

  res.json({
    ok: true,
    note: 'Local demo data has been reset.',
    code,
    wine,
    scene: code.token
  });
});

app.post('/api/admin/codes', async (req, res) => {
  try {
    const { code, wine } = createOneTimeCode(req.body || {});
    const scene = code.token;
    const wechatPayload = {
      scene,
      page: pagePath,
      check_path: true,
      env_version: process.env.WECHAT_ENV_VERSION || 'release'
    };

    let qr = {
      generated: false,
      pendingIntegration: true,
      scene,
      page: pagePath,
      wechatPayload
    };

    if (hasWechatCredentials()) {
      const generated = await generateMiniProgramCode({
        scene,
        token: code.token,
        page: pagePath
      });

      qr = {
        generated: true,
        pendingIntegration: false,
        scene,
        page: pagePath,
        imageUrl: `${process.env.MINIPROGRAM_BASE_URL || `http://127.0.0.1:${port}`}${generated.publicPath}`
      };
    }

    res.json({
      ok: true,
      code,
      wine,
      qr
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.post('/api/redeem/consume', (req, res) => {
  try {
    const scene = (req.body && (req.body.scene || req.body.token)) || '';
    const payload = consumeOneTimeCode(scene);

    res.json({
      ok: true,
      sessionId: payload.session.id,
      session: payload.session,
      experience: payload.experience
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const payload = getSessionExperience(req.params.sessionId);
    res.json({
      ok: true,
      sessionId: payload.session.id,
      session: payload.session,
      experience: payload.experience
    });
  } catch (error) {
    respondError(res, error);
  }
});

app.get('/', (_req, res) => {
  res.redirect('/preview/');
});

app.listen(port, () => {
  console.log(`Hongjiu curator backend listening on http://127.0.0.1:${port}`);
});
