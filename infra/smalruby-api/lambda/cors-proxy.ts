import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const REDIRECT_LIMIT = 5;
const FETCH_TIMEOUT_MS = 30_000;

const TEXT_PREFIXES = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
];

const BINARY_PREFIXES = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip',
    'application/gzip',
    'application/x-tar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'application/octet-stream',
];

const isBinaryContent = (contentType: string): boolean => {
    const lower = contentType.toLowerCase();
    if (TEXT_PREFIXES.some(p => lower.startsWith(p))) return false;
    if (BINARY_PREFIXES.some(p => lower.startsWith(p))) return true;
    return true;
};

const extractGoogleDriveFileId = (url: string): string | null => {
    let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    m = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    return null;
};

const convertGoogleDriveUrl = (url: string): string => {
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
};

interface FetchResult {
    statusCode: number;
    contentType: string;
    body: string;
    isBase64Encoded: boolean;
}

const fetchContent = async (url: string, redirectsRemaining = REDIRECT_LIMIT): Promise<FetchResult> => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`Invalid URL scheme: ${parsed.protocol}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(url, {
            redirect: 'manual',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AWS-Lambda-Proxy/1.0)' },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
            throw new Error('Redirect without location header');
        }
        if (redirectsRemaining <= 0) {
            throw new Error('Too many redirects');
        }
        const next = new URL(location, url).toString();
        return fetchContent(next, redirectsRemaining - 1);
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    if (res.status >= 200 && res.status < 300) {
        if (isBinaryContent(contentType)) {
            const buf = Buffer.from(await res.arrayBuffer());
            return {
                statusCode: 200,
                contentType,
                body: buf.toString('base64'),
                isBase64Encoded: true,
            };
        }
        return {
            statusCode: 200,
            contentType,
            body: await res.text(),
            isBase64Encoded: false,
        };
    }

    return {
        statusCode: res.status,
        contentType: 'application/json',
        body: JSON.stringify({
            code: 'HTTP Error',
            message: `HTTP ${res.status}: ${res.statusText}`,
        }),
        isBase64Encoded: false,
    };
};

export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
    const url = (event.queryStringParameters?.url ?? '').trim();
    if (!url) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'Bad Request', message: 'invalid url' }),
            isBase64Encoded: false,
        };
    }

    try {
        const targetUrl = convertGoogleDriveUrl(url);
        const result = await fetchContent(targetUrl);
        return {
            statusCode: result.statusCode,
            headers: { 'Content-Type': result.contentType },
            body: result.body,
            isBase64Encoded: result.isBase64Encoded,
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'Internal Server Error', message }),
            isBase64Encoded: false,
        };
    }
};
