import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const API_HOST = 'https://synthesis-service.scratch.mit.edu';

/**
 * Proxy for Scratch's text-to-speech synthesis service.
 *
 * Unlike the translate proxy (which forwards text), the synthesis service
 * returns a binary audio file (mp3). API Gateway HTTP API v2 can only carry
 * binary payloads when the Lambda sets `isBase64Encoded: true`, so we Base64
 * encode the audio and let API Gateway decode it back to bytes for the client.
 */
export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
    const locale = (event.queryStringParameters?.locale ?? '').trim();
    const gender = (event.queryStringParameters?.gender ?? '').trim();
    const text = event.queryStringParameters?.text ?? '';

    if (!locale || !gender) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'BadRequest',
                message: 'locale and gender are required',
            }),
            isBase64Encoded: false,
        };
    }

    try {
        const params = new URLSearchParams({ locale, gender, text });
        const res = await fetch(`${API_HOST}/synth?${params.toString()}`);

        if (res.status < 200 || res.status >= 300) {
            // Pass upstream failures through as JSON so the client sees the status.
            const body = await res.text();
            return {
                statusCode: res.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'UpstreamError',
                    message: `HTTP ${res.status}: ${body}`,
                }),
                isBase64Encoded: false,
            };
        }

        const contentType = res.headers.get('content-type') || 'audio/mpeg';
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
            statusCode: 200,
            headers: { 'Content-Type': contentType },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'BadGateway', message }),
            isBase64Encoded: false,
        };
    }
};
