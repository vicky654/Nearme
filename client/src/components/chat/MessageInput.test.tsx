import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { MessageInput } from './MessageInput';

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
  render(<MessageInput {...props} />);
  return props;
}

describe('MessageInput', () => {
  it('auto-grows and sends immediately with Enter', async () => {
    const user = userEvent.setup();
    const props = renderInput();
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
});
