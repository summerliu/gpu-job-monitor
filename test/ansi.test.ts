import { describe, expect, it } from 'vitest';
import { parseLogText } from '@/lib/ansi';

const ESC = String.fromCharCode(27);

describe('parseLogText', () => {
    it('strips ANSI color codes', () => {
        const raw = `${ESC}[32mINFO${ESC}[0m step=1 loss=0.5`;
        expect(parseLogText(raw).text).toBe('INFO step=1 loss=0.5');
    });

    it('detects the level from the (stripped) start of the line', () => {
        expect(parseLogText(`${ESC}[33mWARN${ESC}[0m low disk space`).level).toBe('WARN');
        expect(parseLogText(`${ESC}[31mERROR${ESC}[0m crashed`).level).toBe('ERROR');
    });

    it('returns a null level when the line has no recognizable prefix', () => {
        expect(parseLogText('just some text').level).toBeNull();
    });

    it('leaves plain text without ANSI codes unchanged', () => {
        expect(parseLogText('INFO plain text').text).toBe('INFO plain text');
    });
});
