import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from './login-form';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock('./use-auth', () => ({
  useAuth: () => ({
    login: mocks.login,
    logout: vi.fn().mockResolvedValue(undefined),
    user: null,
    isAuthenticated: false,
    isPending: false,
    error: null,
  }),
}));

function renderForm() {
  return render(
    <BrowserRouter>
      <LoginForm />
    </BrowserRouter>,
  );
}

describe('LoginForm', () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.login.mockResolvedValue(undefined);
  });

  it('renders email and password fields', () => {
    renderForm();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
  });

  it('does not call login when validation fails', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(mocks.login).not.toHaveBeenCalled();
    // Back in the normal state, still on the form.
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('E-mail'), 'a@b.co');
    await user.type(screen.getByLabelText('Senha'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => {
      expect(mocks.login).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret123' });
    });
  });

  it('shows a pending state while submitting and recovers after', async () => {
    let resolveLogin!: () => void;
    mocks.login.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );

    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('E-mail'), 'a@b.co');
    await user.type(screen.getByLabelText('Senha'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const pendingButton = screen.getByRole('button', { name: 'Entrando…' });
    expect(pendingButton.hasAttribute('disabled')).toBe(true);

    resolveLogin();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    });
  });
});
