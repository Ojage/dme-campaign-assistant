import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@dme/contracts/http'
import { createThread, getMessages, getThreads, streamReply } from '@/features/chat/api/chatApi'
import type { DisplayMessage } from '@/features/chat/types/chat.types'
import { queryKeys } from '@/lib/query/queryKeys'

/**
 * One conversation with the assistant.
 *
 * The transcript is server state: it is read from the API and cached by thread id,
 * so opening a drawer on the same thread from another page does not refetch or
 * lose history. Only the reply currently being streamed is local, because it does
 * not exist on the server until the last frame arrives.
 *
 * A reply that is interrupted — the provider errored, the connection dropped, or
 * the server closed the stream before a terminal frame — is kept as a "failed
 * reply". The API persists an assistant turn only once the stream completes, so
 * keeping the partial locally cannot duplicate anything a later refetch returns;
 * it preserves what the user actually read instead of erasing it.
 */

interface StreamState {
  threadId: string
  text: string
}

interface FailedReply {
  threadId: string
  text: string
}

export function useChatThread(language: 'en' | 'fr', fallback: string) {
  const queryClient = useQueryClient()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [stream, setStream] = useState<StreamState | null>(null)
  const [failedReply, setFailedReply] = useState<FailedReply | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // A pending stream belongs to the drawer that started it; closing it must not
  // leave a reply writing into an unmounted component.
  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const threads = useQuery({ queryKey: queryKeys.chat.threads, queryFn: getThreads })

  const messages = useQuery({
    queryKey: queryKeys.chat.messages(threadId ?? ''),
    queryFn: () => getMessages(threadId as string),
    enabled: threadId !== null,
  })

  const transcript: DisplayMessage[] = messages.data?.map((message) => ({
    id: message.id,
    role: message.role,
    text: message.content,
    ...(message.model === undefined ? {} : { model: message.model }),
  })) ?? []

  const display: DisplayMessage[] = [
    ...transcript,
    ...(failedReply === null
      ? []
      : [{ id: `${failedReply.threadId}-failed`, role: 'assistant' as const, text: failedReply.text }]),
    ...(stream === null
      ? []
      : [{ id: `${stream.threadId}-streaming`, role: 'assistant' as const, text: stream.text, streaming: true }]),
  ]

  const selectThread = useCallback((id: string) => {
    setThreadId(id)
    setStream(null)
    setFailedReply(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    setThreadId(null)
    setStream(null)
    setFailedReply(null)
    setError(null)
  }, [])

  const send = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (text.length === 0 || stream !== null) return

      setError(null)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // "Hello?" (zero deltas before the stream failed) is noise, not a reply.
      const keepPartial = (thread: string, partial: string) => {
        if (partial.trim().length === 0) return
        setFailedReply({ threadId: thread, text: partial })
      }

      let id: string | null = null
      let accumulated = ''
      let finished = false
      try {
        // The thread is created on first use, so the drawer needs no setup step.
        id = threadId ?? (await createThread()).id
        setThreadId(id)
        setStream({ threadId: id, text: '' })

        for await (const event of streamReply(id, text, language, controller.signal)) {
          if (controller.signal.aborted) return

          if (event.type === 'delta') {
            accumulated += event.text
            setStream((current) => (current === null ? null : { ...current, text: accumulated }))
          } else if (event.type === 'done') {
            finished = true
            setStream(null)
            void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads })
          } else if (event.type === 'error') {
            finished = true
            keepPartial(id, accumulated)
            setStream(null)
            setError(event.message)
          }
        }

        // The server closed the stream without a terminal frame: anything already
        // streamed is real output, keep it visible rather than erasing it.
        if (!finished && !controller.signal.aborted) keepPartial(id ?? '', accumulated)
        setStream(null)
      } catch (cause) {
        keepPartial(id ?? '', accumulated)
        setStream(null)
        if (controller.signal.aborted) return
        setError(cause instanceof ApiError ? cause.message : fallback)
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [language, queryClient, stream, threadId],
  )

  return {
    threads: threads.data ?? [],
    messages: display,
    isStreaming: stream !== null,
    error,
    threadId,
    selectThread,
    reset,
    send,
  }
}