import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import type { UserInfo } from '@/types/auth';

const mockUser: UserInfo = {
  id_usuario: 1,
  username: 'admin',
  nombre_completo: 'Admin User',
  email: 'admin@garcesfruit.cl',
  rol: 'admin',
  campos_asignados: null,
};

describe('authStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useAuthStore.setState({ user: null, token: null });
  });

  it('has null user and token initially', () => {
    const { user, token } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it('setAuth updates user and token', () => {
    useAuthStore.getState().setAuth('test-token-123', mockUser);
    const { user, token } = useAuthStore.getState();
    expect(token).toBe('test-token-123');
    expect(user).toEqual(mockUser);
  });

  it('logout clears user and token', () => {
    // Set auth first
    useAuthStore.getState().setAuth('test-token-123', mockUser);
    expect(useAuthStore.getState().token).toBe('test-token-123');

    // Now logout
    useAuthStore.getState().logout();
    const { user, token } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
  });

  it('setAuth can be called multiple times to update credentials', () => {
    useAuthStore.getState().setAuth('token-1', mockUser);
    const updatedUser = { ...mockUser, username: 'operator' };
    useAuthStore.getState().setAuth('token-2', updatedUser);

    const { user, token } = useAuthStore.getState();
    expect(token).toBe('token-2');
    expect(user?.username).toBe('operator');
  });
});
