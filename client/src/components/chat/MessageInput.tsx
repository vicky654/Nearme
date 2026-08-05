import { useState, useRef, useEffect, FormEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { micOutline, send } from 'ionicons/icons';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  editingMessage: { id: string; content: string } | null;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, newContent: string) => void;
}

const EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '🙌', '😍', '😎', '🙏', '✨', '🚀'];

export function MessageInput({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
    } else {
      setContent('');
    }
  }, [editingMessage]);

  function handleChange(val: string) {
    setContent(val);
    onTypingStart();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTypingStop();
    }, 1500);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    if (editingMessage) {
      onSaveEdit(editingMessage.id, content.trim());
    } else {
      onSendMessage(content.trim());
    }

    setContent('');
    setShowEmojiPicker(false);
    onTypingStop();
  }

  function addEmoji(emoji: string) {
    setContent((prev) => prev + emoji);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-2 border-t border-gray-200 bg-white p-3 pb-[max(.75rem,var(--sab))] dark:border-gray-800 dark:bg-gray-900"
    >
      {editingMessage && (
        <div className="flex items-center justify-between bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg">
          <span>Editing message</span>
          <button type="button" onClick={onCancelEdit} className="font-bold hover:underline">
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 z-20 grid grid-cols-6 gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="rounded p-1 text-xl hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="rounded-lg p-2 text-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Emoji Picker"
        >
          😀
        </button>

        <button
          type="button"
          onClick={() => alert('Image attachments placeholder - Available in Phase 3 media release')}
          className="rounded-lg p-2 text-xl hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Attach File / Image"
        >
          📎
        </button>

        <input
          type="text"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Type a message..."
          className="min-h-12 flex-1 rounded-2xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />

        <button
          type="submit"
          disabled={!content.trim()}
          aria-label={content.trim() ? (editingMessage ? 'Save message' : 'Send message') : 'Record voice message'}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-xl text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-500 disabled:opacity-50"
        >
          <IonIcon icon={content.trim() ? send : micOutline} />
        </button>
      </div>
    </form>
  );
}
