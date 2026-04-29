import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const API_HOST = 'https://api.scratch.mit.edu';

export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: 'BadRequest', message: 'projectId required' }),
        };
    }

    try {
        const apiUrl = `${API_HOST}/projects/${encodeURIComponent(projectId)}`;
        const res = await fetch(apiUrl);
        const text = await res.text();
        const contentType = res.headers.get('content-type') || 'application/json';
        return {
            statusCode: res.status,
            headers: { 'Content-Type': contentType },
            body: text,
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
