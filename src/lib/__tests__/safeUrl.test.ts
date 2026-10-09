import { describe, it, expect } from 'vitest';
import { safeHttpUrl } from '../safeUrl';

describe('safeHttpUrl', () => {
  it('aceita http e https', () => {
    expect(safeHttpUrl('https://netflix.com/conta')).toBe('https://netflix.com/conta');
    expect(safeHttpUrl(' http://exemplo.com ')).toBe('http://exemplo.com/');
  });
  it('bloqueia esquemas perigosos', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHttpUrl('file:///etc/passwd')).toBeNull();
  });
  it('rejeita vazio, não-string e texto sem esquema', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl('netflix.com')).toBeNull();
    expect(safeHttpUrl('https://' + 'a'.repeat(3000))).toBeNull();
  });
});
