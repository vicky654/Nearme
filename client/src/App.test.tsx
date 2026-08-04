import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from './api/axiosClient';
import App from './App';

describe('App', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onPost('/auth/refresh').reply(401);
  });

  afterEach(() => {
    mock.restore();
    cleanup();
  });

  it('renders the NearMe placeholder home route once the session check completes', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/nearme/i)).toBeInTheDocument());
  });
});
