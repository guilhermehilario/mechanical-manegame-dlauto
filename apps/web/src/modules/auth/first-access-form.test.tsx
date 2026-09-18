import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ApiClientError } from '../../services/api-client';
import { FirstAccessForm } from './first-access-form';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  setupFirstAdmin: vi.fn(),
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

vi.mock('../../services/auth.service', () => ({
  setupFirstAdmin: mocks.setupFirstAdmin,
}));

function renderForm(onAlreadyConfigured?: () => void) {
  return render(
    <BrowserRouter>
      <FirstAccessForm onAlreadyConfigured={onAlreadyConfigured} />
    </BrowserRouter>,
  );
}

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Seu nome'), 'Dono da Oficina');
  await user.type(screen.getByLabelText('E-mail'), 'dono@oficina.local');
  await user.type(screen.getByLabelText('Senha'), 'secret123');
  await user.type(screen.getByLabelText('Confirmar senha'), 'secret123');
  return user;
}

describe('FirstAccessForm', () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.login.mockResolvedValue(undefined);
    mocks.setupFirstAdmin.mockReset();
    mocks.setupFirstAdmin.mockResolvedValue({
      id: 'usr_1',
      name: 'Dono da Oficina',
      email: 'dono@oficina.local',
      role: 'ADMIN',
    });
  });

  it('renders the first-access fields', () => {
    renderForm();
    expect(screen.getByLabelText('Seu nome')).toBeTruthy();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(screen.getByLabelText('Confirmar senha')).toBeTruthy();
  });

  it('does not submit when the passwords do not match', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Seu nome'), 'Dono');
    await user.type(screen.getByLabelText('E-mail'), 'dono@oficina.local');
    await user.type(screen.getByLabelText('Senha'), 'secret123');
    await user.type(screen.getByLabelText('Confirmar senha'), 'secret124');
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    expect(mocks.setupFirstAdmin).not.toHaveBeenCalled();
    expect(screen.getByText('As senhas não conferem.')).toBeTruthy();
  });

  it('rejects a weak password through the shared schema', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Seu nome'), 'Dono');
    await user.type(screen.getByLabelText('E-mail'), 'dono@oficina.local');
    await user.type(screen.getByLabelText('Senha'), 'weakpass');
    await user.type(screen.getByLabelText('Confirmar senha'), 'weakpass');
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    expect(mocks.setupFirstAdmin).not.toHaveBeenCalled();
  });

  it('creates the admin and logs in with the same credentials', async () => {
    renderForm();
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    await waitFor(() => {
      expect(mocks.setupFirstAdmin).toHaveBeenCalledWith({
        name: 'Dono da Oficina',
        email: 'dono@oficina.local',
        password: 'secret123',
      });
      expect(mocks.login).toHaveBeenCalledWith({
        email: 'dono@oficina.local',
        password: 'secret123',
      });
    });
  });

  it('falls back to the login screen when setup was already completed', async () => {
    const onAlreadyConfigured = vi.fn();
    mocks.setupFirstAdmin.mockRejectedValue(
      new ApiClientError('SETUP_ALREADY_COMPLETED', 'já concluído', 409),
    );

    renderForm(onAlreadyConfigured);
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    await waitFor(() => {
      expect(onAlreadyConfigured).toHaveBeenCalledTimes(1);
    });
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows a generic error when the request fails', async () => {
    mocks.setupFirstAdmin.mockRejectedValue(new Error('boom'));

    renderForm();
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }));

    await waitFor(() => {
      expect(
        screen.getByText('Não foi possível concluir a configuração. Tente novamente.'),
      ).toBeTruthy();
    });
  });
});
