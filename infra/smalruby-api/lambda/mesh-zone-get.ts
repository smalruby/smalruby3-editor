import type {
    APIGatewayProxyEventV2,
    APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

const SECRET_KEY = process.env.MESH_ZONE_SECRET_KEY;

const CRC32_TABLE: number[] = (() => {
    const table = new Array<number>(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
})();

const crc32 = (input: string): number => {
    const buf = Buffer.from(input, 'utf8');
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

export const handler = async (
    event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
    if (!SECRET_KEY) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'ConfigError',
                message: 'MESH_ZONE_SECRET_KEY is not configured',
            }),
        };
    }

    const sourceIp = event.requestContext?.http?.sourceIp || 'none';
    const domain = crc32(SECRET_KEY + sourceIp).toString(16);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
    };
};
