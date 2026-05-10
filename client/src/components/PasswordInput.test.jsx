import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
    it('varsayılan olarak type=password render eder', () => {
        render(<PasswordInput value="" onChange={vi.fn()} />);
        const inp = document.querySelector('input');
        expect(inp.type).toBe('password');
    });

    it('göz ikonuna tıklayınca type=text olur', () => {
        render(<PasswordInput value="secret" onChange={vi.fn()} />);
        const btn = screen.getByRole('button', { name: /göster/i });
        fireEvent.click(btn);
        const inp = document.querySelector('input');
        expect(inp.type).toBe('text');
    });

    it('tekrar tıklayınca type=password geri döner', () => {
        render(<PasswordInput value="secret" onChange={vi.fn()} />);
        const btn = screen.getByRole('button');
        fireEvent.click(btn); // show
        fireEvent.click(btn); // hide
        const inp = document.querySelector('input');
        expect(inp.type).toBe('password');
    });

    it('placeholder prop iletilir', () => {
        render(<PasswordInput value="" onChange={vi.fn()} placeholder="Şifrenizi girin" />);
        expect(document.querySelector('input').placeholder).toBe('Şifrenizi girin');
    });

    it('onChange callback tetiklenir', () => {
        const handler = vi.fn();
        render(<PasswordInput value="" onChange={handler} />);
        fireEvent.change(document.querySelector('input'), { target: { value: 'abc' } });
        expect(handler).toHaveBeenCalledOnce();
    });
});
