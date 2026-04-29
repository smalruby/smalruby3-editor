import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const API_HOST = 'https://translate-service.scratch.mit.edu';

export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
    const language = (event.queryStringParameters?.language ?? '').trim();
    const text = event.queryStringParameters?.text ?? '';

    if (!language) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'BadRequest', message: 'invalid locale code' }),
        };
    }

    try {
        const params = new URLSearchParams({ language, text });
        const res = await fetch(`${API_HOST}/translate?${params.toString()}`);
        const body = await res.text();
        const contentType = res.headers.get('content-type') || 'application/json';
        return {
            statusCode: res.status,
            headers: { 'Content-Type': contentType },
            body,
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
            statusCode: 502,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'BadGateway', message }),
        };
    }
};
