import { describe, expect, it, vi } from 'vitest';
import { el } from './dom.js';

describe('el', () => {
  it('sets text via textContent, never parsing HTML', () => {
    const node = el('span', { text: '<b>not bold</b>' });
    expect(node.textContent).toBe('<b>not bold</b>');
    expect(node.querySelector('b')).toBeNull();
  });

  it('applies styles through CSSOM', () => {
    const node = el('div', { style: { color: 'red', display: 'flex' } });
    expect(node.style.color).toBe('red');
    expect(node.style.display).toBe('flex');
  });

  it('adds classes, attributes, and children', () => {
    const node = el('a', {
      class: ['btn', 'btn--primary'],
      attrs: { href: '#diff-abc', role: 'link' },
      children: ['open ', el('code', { text: 'file.ts' })],
    });
    expect(node.classList.contains('btn')).toBe(true);
    expect(node.classList.contains('btn--primary')).toBe(true);
    expect(node.getAttribute('href')).toBe('#diff-abc');
    expect(node.getAttribute('role')).toBe('link');
    expect(node.textContent).toBe('open file.ts');
  });

  it('wires listeners via addEventListener', () => {
    const onClick = vi.fn();
    const node = el('button', { on: { click: onClick } });
    node.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
