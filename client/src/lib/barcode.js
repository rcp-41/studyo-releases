const CODE39 = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

export function generateCode39SVG(text, options = {}) {
    const {
        narrowWidth = 1.5,
        wideWidth = 3.75,
        height = 40,
        fontSize = 10,
        showText = true,
        padding = 4,
        textMargin = 2
    } = options;

    const input = String(text == null ? '' : text).toUpperCase();
    const validated = input.split('').filter(c => CODE39[c]).join('');
    const encoded = '*' + validated + '*';

    let x = padding;
    let bars = '';
    for (const ch of encoded) {
        const pattern = CODE39[ch];
        for (let i = 0; i < 9; i++) {
            const w = pattern[i] === '1' ? wideWidth : narrowWidth;
            const isBar = i % 2 === 0;
            if (isBar) {
                bars += `<rect x="${x.toFixed(2)}" y="0" width="${w}" height="${height}" fill="#000"/>`;
            }
            x += w;
        }
        x += narrowWidth;
    }

    const totalWidth = x + padding;
    const totalHeight = showText ? height + fontSize + textMargin + 2 : height;
    const label = showText && validated
        ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${height + fontSize + textMargin}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${validated}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth.toFixed(2)}" height="${totalHeight}" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight}">${bars}${label}</svg>`;
}

export function isValidCode39Char(ch) {
    return CODE39.hasOwnProperty(String(ch).toUpperCase());
}
