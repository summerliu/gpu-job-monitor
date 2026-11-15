export type LogLevel = 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';

const ESC = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');
const LEVEL_PATTERN = /^(INFO|DEBUG|WARN|ERROR)\b/;

/** 去除 ANSI 色碼，並從純文字開頭偵測 log level（server 固定把 level 放在行首）。 */
export function parseLogText(raw: string): { level: LogLevel | null; text: string } {
    const text = raw.replace(ANSI_PATTERN, '');
    const match = LEVEL_PATTERN.exec(text);
    return { level: (match?.[1] as LogLevel | undefined) ?? null, text };
}
