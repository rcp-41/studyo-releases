const https = require('https');
const token = process.env.GH_TOKEN;
if (!token) {
    console.error('Missing GH_TOKEN environment variable');
    process.exit(1);
}

function req(method, path, body) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'api.github.com',
            path: `/repos/rcp-41/studyo-releases${path}`,
            method,
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'node',
                'Accept': 'application/vnd.github.v3+json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
        };
        const r = https.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch { resolve({ status: res.statusCode, data: d }); }
            });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

(async () => {
    const { status, data: releases } = await req('GET', '/releases');
    console.log('API Status:', status);
    if (!Array.isArray(releases)) { console.log(JSON.stringify(releases).slice(0, 500)); return; }

    for (const r of releases) {
        console.log(`${r.tag_name} | draft=${r.draft} | id=${r.id}`);
        if (r.draft) {
            console.log(`  -> Publishing ${r.tag_name}...`);
            const pub = await req('PATCH', `/releases/${r.id}`, { draft: false });
            console.log(`  -> Result: ${pub.status}`);
        }
    }
    console.log('Done!');
})();
