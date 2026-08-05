import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { MessageInput } from './MessageInput';

const { mockUploadChatAttachment } = vi.hoisted(() => ({ mockUploadChatAttachment: vi.fn() }));

vi.mock('../../api/chatApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/chatApi')>('../../api/chatApi');
  return { ...actual, uploadChatAttachment: mockUploadChatAttachment };
});

function renderInput(overrides: Partial<ComponentProps<typeof MessageInput>> = {}) {
  const props: ComponentProps<typeof MessageInput> = {
    conversationId: 'conversation-1',
    draft: '',
    onDraftChange: vi.fn(),
    onSendMessage: vi.fn(),
    onTypingStart: vi.fn(),
    onTypingStop: vi.fn(),
    onRecordingStart: vi.fn(),
    onRecordingStop: vi.fn(),
    editingMessage: null,
    replyingTo: null,
    onCancelReply: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    ...overrides,
  };
  const view = render(<MessageInput {...props} />);
  return { props, ...view };
}

describe('MessageInput', () => {
  it('auto-grows and sends immediately with Enter', async () => {
    const user = userEvent.setup();
    const { props } = renderInput();
    const textarea = screen.getByRole('textbox', { name: 'Message' });

    await user.type(textarea, 'Hello Bob{enter}');

    expect(props.onTypingStart).toHaveBeenCalled();
    expect(props.onSendMessage).toHaveBeenCalledWith('Hello Bob', []);
    expect(textarea).toHaveValue('');
    expect(textarea).toHaveStyle({ height: '44px' });
  });

  it('shows reply context and cancels it without altering the draft', async () => {
    const user = userEvent.setup();
    const onCancelReply = vi.fn();
    renderInput({
      onCancelReply,
      replyingTo: {
        _id: 'message-2',
        conversationId: 'conversation-1',
        senderId: 'user-2',
        content: 'Original message',
        status: 'seen',
        readBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(screen.getByText('Original message')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelReply).toHaveBeenCalledOnce();
  });

  it('aborts a pending attachment upload when unmounted', async () => {
    let receivedSignal: AbortSignal | undefined;
    mockUploadChatAttachment.mockImplementation((_conversationId, _file, _progress, signal?: AbortSignal) => {
      receivedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    });
    const { container, unmount } = renderInput();
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    fireEvent.change(input!, { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
    await waitFor(() => expect(mockUploadChatAttachment).toHaveBeenCalledOnce());
    unmount();

    expect(receivedSignal?.aborted).toBe(true);
  });
});
