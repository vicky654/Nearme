import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IonIcon } from '@ionic/react';
import { attachOutline, cameraOutline, close, documentOutline, happyOutline, imageOutline, micOutline, send, stop } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import type { ChatAttachment, ChatMessage } from '../../api/chatApi';
import { uploadChatAttachment } from '../../api/chatApi';
import { getFriendlyApiError } from '../../api/errors';
import { toast } from '../../store/toastStore';

interface MessageInputProps {
  conversationId: string;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSendMessage: (content: string, attachments?: ChatAttachment[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  editingMessage: { id: string; content: string } | null;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, newContent: string) => void;
}

const EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '🙌', '😍', '😎', '🙏', '✨', '🚀'];

export function MessageInput({
  conversationId,
  draft,
  onDraftChange,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onRecordingStart,
  onRecordingStop,
  editingMessage,
  replyingTo,
  onCancelReply,
  onCancelEdit,
  onSaveEdit,
}: MessageInputProps) {
  const [content, setContent] = useState(draft);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const stopCallbacksRef = useRef({ onTypingStop, onRecordingStop });
  stopCallbacksRef.current = { onTypingStop, onRecordingStop };

  useEffect(() => {
    setContent(editingMessage?.content || draft);
    if (editingMessage) {
      setAttachments([]);
    }
  }, [draft, editingMessage]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(144, Math.max(44, textarea.scrollHeight))}px`;
  }, [content]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    stopCallbacksRef.current.onTypingStop();
    stopCallbacksRef.current.onRecordingStop();
  }, []);

  function handleChange(value: string) {
    setContent(value);
    if (!editingMessage) onDraftChange(value);
    if (value.trim()) onTypingStart();
    else onTypingStop();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(onTypingStop, 1_800);
  }

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (isUploading || (!content.trim() && attachments.length === 0)) return;
    if (editingMessage) onSaveEdit(editingMessage.id, content.trim());
    else {
      const fallback = attachments[0]?.type === 'image' ? 'Photo' : attachments[0]?.type === 'audio' ? 'Voice message' : attachments[0] ? 'Attachment' : '';
      onSendMessage(content.trim() || fallback, attachments);
    }
    setContent('');
    if (!editingMessage) onDraftChange('');
    setAttachments([]);
    setShowEmojiPicker(false);
    setShowAttachments(false);
    onTypingStop();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }

  async function uploadFiles(files: File[]) {
    const availableSlots = Math.max(0, 4 - attachments.length);
    const selected = files.slice(0, availableSlots);
    if (selected.length === 0) return;
    setIsUploading(true);
    setShowAttachments(false);
    try {
      const uploaded: ChatAttachment[] = [];
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        if (!file) continue;
        if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} is larger than 8 MB`);
        const result = await uploadChatAttachment(conversationId, file, (progress) => {
          setUploadProgress(Math.round(((index + progress / 100) / selected.length) * 100));
        });
        uploaded.push(result.attachment);
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      toast.error(getFriendlyApiError(error, error instanceof Error ? error.message : 'Unable to upload this attachment.').message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice recording is not supported on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || mimeType });
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        if (blob.size === 0) return;
        const extension = blob.type.includes('webm') ? 'webm' : 'm4a';
        await uploadFiles([new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type })]);
      };
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((seconds) => {
        if (seconds >= 119) {
          queueMicrotask(stopRecording);
          return 120;
        }
        return seconds + 1;
      }), 1_000);
      onRecordingStart();
      if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    } catch {
      toast.error('Microphone access is required to record a voice message.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    onRecordingStop();
  }

  const canSend = Boolean(content.trim() || attachments.length > 0);

  return (
    <form onSubmit={handleSubmit} className="relative z-30 border-t border-gray-200/70 bg-white/92 px-2.5 pb-[max(.65rem,var(--sab))] pt-2 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/92 sm:px-4">
      <AnimatePresence initial={false}>
        {(editingMessage || replyingTo) && (
          <motion.div initial={{ opacity: 0, y: 8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 6, height: 0 }} className="mb-2 overflow-hidden rounded-2xl border-l-[3px] border-brand-500 bg-brand-50 px-3 py-2 text-xs dark:bg-brand-500/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-bold text-brand-600 dark:text-brand-400">{editingMessage ? 'Editing message' : 'Replying to message'}</span>
                <p className="truncate text-gray-500 dark:text-gray-300">{editingMessage?.content || replyingTo?.content}</p>
              </div>
              <button type="button" onClick={editingMessage ? onCancelEdit : onCancelReply} aria-label="Cancel" className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-brand-100 dark:hover:bg-gray-800"><IonIcon icon={close} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(attachments.length > 0 || isUploading) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {attachments.map((attachment) => (
              <div key={attachment.url} className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                {attachment.type === 'image' ? <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-1 text-center text-[9px] font-bold text-gray-500"><IonIcon icon={attachment.type === 'audio' ? micOutline : documentOutline} className="text-xl" /><span className="line-clamp-1">{attachment.name}</span></div>}
                <button type="button" onClick={() => setAttachments((current) => current.filter((candidate) => candidate.url !== attachment.url))} aria-label={`Remove ${attachment.name}`} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gray-950/75 text-white"><IonIcon icon={close} /></button>
              </div>
            ))}
            {isUploading && <div className="grid h-16 w-20 shrink-0 place-items-center rounded-2xl bg-brand-50 text-[10px] font-bold text-brand-600 dark:bg-brand-500/10"><span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{uploadProgress}%</div>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ type: 'spring', stiffness: 440, damping: 28 }} className="absolute bottom-[calc(100%+.5rem)] left-3 z-40 grid grid-cols-6 gap-1 rounded-[1.4rem] border border-gray-200 bg-white/96 p-2.5 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/96">
            {EMOJIS.map((emoji) => <motion.button whileHover={{ scale: 1.18, y: -2 }} whileTap={{ scale: 0.8 }} key={emoji} type="button" onClick={() => { setContent((value) => value + emoji); textareaRef.current?.focus(); }} className="grid h-9 w-9 place-items-center rounded-xl text-xl hover:bg-gray-100 dark:hover:bg-gray-800">{emoji}</motion.button>)}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAttachments && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }} transition={{ type: 'spring', stiffness: 440, damping: 28 }} className="absolute bottom-[calc(100%+.5rem)] left-12 z-40 flex gap-2 rounded-[1.4rem] border border-gray-200 bg-white/96 p-2.5 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/96">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-16 flex-col items-center gap-1 rounded-2xl p-2 text-[10px] font-bold hover:bg-gray-100 dark:hover:bg-gray-800"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15"><IonIcon icon={imageOutline} className="text-xl" /></span>Photos</button>
            <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex w-16 flex-col items-center gap-1 rounded-2xl p-2 text-[10px] font-bold hover:bg-gray-100 dark:hover:bg-gray-800"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15"><IonIcon icon={cameraOutline} className="text-xl" /></span>Camera</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-16 flex-col items-center gap-1 rounded-2xl p-2 text-[10px] font-bold hover:bg-gray-100 dark:hover:bg-gray-800"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15"><IonIcon icon={documentOutline} className="text-xl" /></span>File</button>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={fileInputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain" onChange={(event) => void uploadFiles(Array.from(event.target.files || []))} />
      <input ref={cameraInputRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => void uploadFiles(Array.from(event.target.files || []))} />

      <div className="flex items-end gap-1.5">
        <motion.button whileTap={{ scale: 0.88, rotate: -8 }} type="button" onClick={() => { setShowEmojiPicker((value) => !value); setShowAttachments(false); }} aria-label="Choose emoji" aria-expanded={showEmojiPicker} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"><IonIcon icon={happyOutline} /></motion.button>
        <motion.button whileTap={{ scale: 0.88, rotate: 8 }} type="button" disabled={Boolean(editingMessage)} onClick={() => { setShowAttachments((value) => !value); setShowEmojiPicker(false); }} aria-label="Add attachment" aria-expanded={showAttachments} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"><IonIcon icon={attachOutline} /></motion.button>

        <div className={`flex min-h-11 min-w-0 flex-1 items-end rounded-[1.35rem] border px-3.5 transition ${isRecording ? 'border-coral/50 bg-coral/5' : 'border-gray-200 bg-gray-100 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-800'}`}>
          {isRecording ? (
            <div className="flex h-11 w-full items-center gap-3 text-sm font-semibold text-coral"><motion.span animate={{ scale: [1, 1.4, 1], opacity: [1, .55, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-2.5 w-2.5 rounded-full bg-coral" />Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</div>
          ) : (
            <textarea ref={textareaRef} rows={1} value={content} onChange={(event) => handleChange(event.target.value)} onKeyDown={handleKeyDown} maxLength={4000} placeholder="Message…" aria-label="Message" className="max-h-36 min-h-11 w-full resize-none overflow-y-auto bg-transparent py-3 text-sm leading-5 outline-none placeholder:text-gray-400 dark:text-gray-100" />
          )}
        </div>

        <motion.button
          layout
          whileTap={{ scale: 0.86 }}
          type={canSend ? 'submit' : 'button'}
          disabled={isUploading}
          onClick={!canSend ? () => { if (isRecording) stopRecording(); else void startRecording(); } : undefined}
          aria-label={canSend ? (editingMessage ? 'Save message' : 'Send message') : isRecording ? 'Stop recording' : 'Record voice message'}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1.15rem] text-xl text-white shadow-lg transition disabled:opacity-50 ${isRecording ? 'bg-coral shadow-coral/25' : 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-brand-500/25'}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={canSend ? 'send' : isRecording ? 'stop' : 'mic'} initial={{ opacity: 0, scale: 0.5, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5, rotate: 30 }} className="grid"><IonIcon icon={canSend ? send : isRecording ? stop : micOutline} /></motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </form>
  );
}
