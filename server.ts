import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const NEXCONN_DEFAULT_API_URL = 'https://api-sg.nexconn.ai';
const NEXCONN_DEFAULT_SUPPORT_ID = 'lineless_support';
const BOOTSTRAPPED_ADMIN_EMAIL = 'thejashwinin61@gmail.com';

interface FirebaseServerConfig {
  apiKey: string;
  projectId: string;
  databaseId: string;
}

function loadFirebaseServerConfig(): FirebaseServerConfig | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as {
      apiKey?: string;
      projectId?: string;
      firestoreDatabaseId?: string;
    };
    if (!parsed.apiKey) return null;
    return {
      apiKey: parsed.apiKey,
      projectId: parsed.projectId || '',
      databaseId: parsed.firestoreDatabaseId || '(default)',
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(
  idToken: string,
  firebaseApiKey: string
): Promise<{ uid: string; name?: string; email?: string; emailVerified?: boolean } | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      users?: Array<{
        localId?: string;
        displayName?: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return {
      uid: user.localId,
      name: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
    };
  } catch {
    return null;
  }
}

async function verifyStaffAuthorization(
  verifiedUser: { uid: string; email?: string; emailVerified?: boolean },
  idToken: string,
  fbConfig: FirebaseServerConfig
): Promise<boolean> {
  if (
    verifiedUser.email &&
    verifiedUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
    verifiedUser.emailVerified === true
  ) {
    return true;
  }

  if (!fbConfig.projectId) return false;
  try {
    const staffDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      fbConfig.projectId
    )}/databases/${encodeURIComponent(fbConfig.databaseId)}/documents/staff/${encodeURIComponent(
      verifiedUser.uid
    )}`;
    const res = await fetch(staffDocUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getNexconnConfigStatus() {
  const appKey = (process.env.NEXCONN_APP_KEY || process.env.VITE_NEXCONN_APP_KEY || '').trim();
  const appSecret = (process.env.NEXCONN_APP_SECRET || '').trim();
  const clientAppKey = (process.env.VITE_NEXCONN_APP_KEY || '').trim();
  const apiUrl = (process.env.NEXCONN_API_URL || NEXCONN_DEFAULT_API_URL)
    .trim()
    .replace(/\/+$/, '');
  const supportTargetId = (
    process.env.NEXCONN_SUPPORT_USER_ID || NEXCONN_DEFAULT_SUPPORT_ID
  ).trim();

  const missing: string[] = [];
  if (!clientAppKey) missing.push('VITE_NEXCONN_APP_KEY');
  if (!appKey) missing.push('NEXCONN_APP_KEY');
  if (!appSecret) missing.push('NEXCONN_APP_SECRET');

  return {
    configured: Boolean(appKey && appSecret),
    serverConfigured: Boolean(appKey && appSecret),
    appKeyConfigured: Boolean(appKey || clientAppKey),
    supportTargetId,
    apiUrl,
    missing,
    appKey,
    appSecret,
  };
}

function sanitizeId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'LINELESS Visitor';
  const cleaned = raw.trim().slice(0, 64);
  return cleaned || 'LINELESS Visitor';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  const firebaseConfig = loadFirebaseServerConfig();

  // Nexconn SDK configuration check endpoint (returns public appKey only, never secrets)
  app.get('/api/nexconn/status', (_req, res) => {
    const status = getNexconnConfigStatus();
    res.json({
      configured: status.configured,
      serverConfigured: status.serverConfigured,
      appKeyConfigured: status.appKeyConfigured,
      appKey: status.appKey || undefined,
      supportTargetId: status.supportTargetId,
      missing: status.missing,
    });
  });

  // Server-side Nexconn user token exchange (never exposes NEXCONN_APP_SECRET)
  app.post('/api/nexconn/token', async (req, res) => {
    const cfg = getNexconnConfigStatus();
    if (!cfg.serverConfigured) {
      res.status(503).json({
        configured: false,
        missing: cfg.missing,
        error:
          'Nexconn Chat server credentials (NEXCONN_APP_KEY and NEXCONN_APP_SECRET) are not configured.',
      });
      return;
    }

    const body = (req.body || {}) as {
      mode?: 'visitor' | 'staff';
      name?: string;
      isDemoVisitor?: boolean;
      isDemoStaff?: boolean;
      demoSessionId?: string;
    };

    const requestedMode = body.mode === 'staff' ? 'staff' : 'visitor';
    let nexconnUserId = '';
    let nexconnUserName = sanitizeName(
      body.name || (requestedMode === 'staff' ? 'LINELESS Support Desk' : 'LINELESS Visitor')
    );

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7).trim();
      if (!firebaseConfig) {
        res.status(500).json({ error: 'Firebase configuration missing on server.' });
        return;
      }
      const verified = await verifyFirebaseIdToken(idToken, firebaseConfig.apiKey);
      if (!verified) {
        res.status(401).json({ error: 'Invalid or expired authentication token.' });
        return;
      }

      if (requestedMode === 'staff') {
        const authorizedStaff = await verifyStaffAuthorization(verified, idToken, firebaseConfig);
        if (!authorizedStaff) {
          res.status(403).json({ error: 'Staff authorization required for Support Centre.' });
          return;
        }
        nexconnUserId = sanitizeId(cfg.supportTargetId) || NEXCONN_DEFAULT_SUPPORT_ID;
        nexconnUserName = sanitizeName(body.name || verified.name || 'LINELESS Support Desk');
      } else {
        nexconnUserId = sanitizeId(`ln_${verified.uid}`);
        if (verified.name) {
          nexconnUserName = sanitizeName(verified.name);
        }
      }
    } else if (requestedMode === 'staff' && body.isDemoStaff === true) {
      nexconnUserId = sanitizeId(cfg.supportTargetId) || NEXCONN_DEFAULT_SUPPORT_ID;
      nexconnUserName = 'LINELESS Support Desk';
    } else if (requestedMode === 'visitor' && body.isDemoVisitor === true) {
      const demoId = sanitizeId(body.demoSessionId || 'default');
      nexconnUserId = `ln_demo_${demoId || 'default'}`;
      nexconnUserName = 'Demo Visitor';
    } else {
      res.status(401).json({ error: 'Authentication required to initialize support chat.' });
      return;
    }

    try {
      const nonce = crypto.randomBytes(12).toString('hex');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHash('sha1')
        .update(`${cfg.appSecret}${nonce}${timestamp}`)
        .digest('hex');

      const formBody = new URLSearchParams({
        userId: nexconnUserId,
        name: nexconnUserName,
      });

      const response = await fetch(`${cfg.apiUrl}/user/getToken.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'App-Key': cfg.appKey,
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: signature,
        },
        body: formBody.toString(),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        code?: number;
        token?: string;
        userId?: string;
        errorMessage?: string;
      };

      if (!response.ok || (payload.code && payload.code !== 200) || !payload.token) {
        res.status(502).json({
          configured: true,
          error:
            payload.errorMessage ||
            `Nexconn token exchange returned status ${payload.code ?? response.status}.`,
        });
        return;
      }

      res.json({
        configured: true,
        token: payload.token,
        userId: payload.userId || nexconnUserId,
        supportTargetId: cfg.supportTargetId,
      });
    } catch (err) {
      console.error('Nexconn token endpoint error:', err);
      res.status(502).json({
        configured: true,
        error: 'Unable to reach Nexconn token service.',
      });
    }
  });

  // Authenticated staff branch access verification (never trusts demo code 2408 for live branches)
  app.post('/api/staff/verify-branch', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ verified: false, error: 'Authentication required to access live branch.' });
      return;
    }

    if (!firebaseConfig) {
      res.status(500).json({ verified: false, error: 'Firebase configuration missing on server.' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(idToken, firebaseConfig.apiKey);
    if (!verified) {
      res.status(401).json({ verified: false, error: 'Invalid or expired authentication token.' });
      return;
    }

    const authorizedStaff = await verifyStaffAuthorization(verified, idToken, firebaseConfig);
    if (!authorizedStaff) {
      res.status(403).json({ verified: false, error: 'Staff authorization required.' });
      return;
    }

    const body = (req.body || {}) as { branchId?: string; accessCode?: string };
    const branchId = typeof body.branchId === 'string' ? body.branchId.trim() : '';
    const submittedCode = typeof body.accessCode === 'string' ? body.accessCode.trim() : '';

    if (!branchId || !submittedCode) {
      res.status(400).json({ verified: false, error: 'Branch and access code are required.' });
      return;
    }

    if (branchId === 'branch-lalbagh') {
      res.status(400).json({ verified: false, error: 'Use demo verification for the demo branch.' });
      return;
    }

    const configuredCode = (
      process.env.STAFF_BRANCH_ACCESS_CODE ||
      process.env.BRANCH_ACCESS_CODE ||
      ''
    ).trim();

    if (!configuredCode) {
      res.status(403).json({
        verified: false,
        error: 'Live branch access codes are not configured on this server. Select Lalbagh Demo Branch.',
      });
      return;
    }

    const isMatch =
      submittedCode.length === configuredCode.length &&
      crypto.timingSafeEqual(Buffer.from(submittedCode), Buffer.from(configuredCode));

    if (!isMatch) {
      res.status(403).json({
        verified: false,
        error: 'Incorrect access code for this branch. Please try again.',
      });
      return;
    }

    res.json({ verified: true, branchId });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LINELESS server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
