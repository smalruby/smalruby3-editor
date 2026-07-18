/**
 * Smalruby Admin API (EPIC #1073, S1 #1081).
 *
 * The highest-privilege surface in the fleet, so the model is deliberately
 * strict and small:
 *
 * - Google Sign-In only, verified against the ADMIN-DEDICATED client ID
 *   (decision B) — editor/classroom tokens carry a different `aud` and are
 *   rejected before any authorization lookup.
 * - Deny-by-default allowlist (decision C/F4): the SmalrubyAdmins table is
 *   populated by a human in the AWS console (verified email). On the first
 *   successful login the Google `sub` is pinned onto the row; afterwards a
 *   token whose sub differs from the pinned one is rejected even if the
 *   email matches (email-reuse defense). There is no in-app admin
 *   management.
 * - Every mutation is audit-logged (bug-report audit() pattern); prod log
 *   retention is one year (set in the stack).
 *
 * S1 exposes only GET /admin/me (authorization probe for the SPA). The
 * management domains (みんなの課題 / classroom / restore) land in S3/S4.
 */
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { OAuth2Client } from 'google-auth-library';

// --- Configuration ---

const ADMINS_TABLE = process.env.ADMINS_TABLE_NAME || 'SmalrubyAdmins';
const ADMIN_GOOGLE_CLIENT_ID = process.env.ADMIN_GOOGLE_CLIENT_ID || '';
const DEV_BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || '';
const STAGE = process.env.STAGE || 'stg';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const googleClient = new OAuth2Client(ADMIN_GOOGLE_CLIENT_ID);

// --- Errors (bug-report conventions: authn 401 / authz 403) ---

class AuthError extends Error {}
class ForbiddenError extends Error {}
class NotFoundError extends Error {}

// --- Identity ---

export interface AdminIdentity {
  sub: string;
  email: string;
  name: string | null;
}

function extractBearerToken(header: string | undefined): string {
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('Missing bearer token');
  }
  return header.slice('Bearer '.length);
}

async function verifyGoogleIdToken(idToken: string): Promise<AdminIdentity> {
  // Dev bypass (stg only; the stack refuses to deploy it to prod).
  if (DEV_BYPASS_TOKEN && STAGE !== 'prod' && idToken === DEV_BYPASS_TOKEN) {
    return { sub: 'dev-admin', email: 'dev-admin@example.com', name: 'Dev Admin' };
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // Admin-dedicated audience (decision B): tokens minted for the editor
      // client ID fail here by design.
      audience: ADMIN_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      throw new AuthError('Token payload is missing a verified email');
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || null,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Invalid ID token');
  }
}

// --- Authorization (deny-by-default allowlist) ---

/**
 * Decide the authorization outcome for a verified identity against the
 * allowlist row (pure — the pin/deny matrix is unit-tested directly).
 * @param row - the SmalrubyAdmins item for the identity's email (or null)
 * @param identity - the verified Google identity
 * @returns 'denied' | 'pin' (first login: pin the sub) | 'ok'
 */
export function authorizationOutcome(
  row: Record<string, unknown> | null,
  identity: AdminIdentity,
): 'denied' | 'pin' | 'ok' {
  if (!row) return 'denied';
  const pinned = row.sub;
  if (typeof pinned !== 'string' || pinned.length === 0) return 'pin';
  return pinned === identity.sub ? 'ok' : 'denied';
}

async function requireAdmin(identity: AdminIdentity): Promise<void> {
  const result = await docClient.send(new GetCommand({
    TableName: ADMINS_TABLE,
    Key: { email: identity.email },
  }));
  const outcome = authorizationOutcome((result.Item as Record<string, unknown>) || null, identity);

  if (outcome === 'denied') {
    audit('admin.denied', identity, {});
    throw new ForbiddenError('Not an administrator');
  }
  if (outcome === 'pin') {
    // First login: pin the Google sub so a later token with the same email
    // but a different account is rejected (email-reuse defense).
    await docClient.send(new UpdateCommand({
      TableName: ADMINS_TABLE,
      Key: { email: identity.email },
      UpdateExpression: 'SET #sub = :sub, firstLoginAt = :now',
      // Never overwrite an existing pin (raced first logins).
      ConditionExpression: 'attribute_not_exists(#sub)',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': identity.sub, ':now': new Date().toISOString() },
    }));
    audit('admin.subPinned', identity, {});
  }
}

// --- Audit log (structured, CloudWatch; bug-report pattern) ---

function audit(action: string, identity: AdminIdentity, extra: Record<string, unknown>): void {
  console.log(JSON.stringify({
    audit: true,
    action,
    adminSub: identity.sub,
    adminEmail: identity.email,
    ...extra,
  }));
}

// --- CORS ---

function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = origin && CORS_ALLOWED_ORIGINS.includes(origin)
    ? origin
    : CORS_ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

// --- Handlers ---

async function handleMe(identity: AdminIdentity): Promise<APIGatewayProxyStructuredResultV2> {
  return {
    statusCode: 200,
    body: JSON.stringify({
      email: identity.email,
      name: identity.name,
      stage: STAGE,
    }),
  };
}

// --- Main handler ---

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;

    // Every route requires an authenticated + authorized administrator.
    const token = extractBearerToken(event.headers?.authorization);
    const identity = await verifyGoogleIdToken(token);
    await requireAdmin(identity);

    let result: APIGatewayProxyStructuredResultV2;
    if (method === 'GET' && path === '/admin/me') {
      result = await handleMe(identity);
    } else {
      throw new NotFoundError('Not found');
    }

    return { ...result, headers: { ...corsHeaders, ...result.headers } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof ForbiddenError) {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    if (err instanceof NotFoundError) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    }
    console.error('Handler error:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
