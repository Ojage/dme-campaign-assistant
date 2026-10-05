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
 */

interface StreamState {
  threadId: string
  text: string
}

export function useChatThread(language: 'en' | 'fr', fallback: string) {
  const queryClient = useQueryClient()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [stream, setStream] = useState<StreamState | null>(null)
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

  const display: DisplayMessage[] =
    stream === null
      ? transcript
      : [
          ...transcript,
          { id: `${stream.threadId}-streaming`, role: 'assistant', text: stream.text, streaming: true },
        ]

  const selectThread = useCallback((id: string) => {
    setThreadId(id)
    setStream(null)
    setError(null)
  }, [])

  const reset = useCallback(() => {
    setThreadId(null)
    setStream(null)
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

      try {
        // The thread is created on first use, so the drawer needs no setup step.
        const id = threadId ?? (await createThread()).id
        setThreadId(id)
        setStream({ threadId: id, text: '' })

        for await (const event of streamReply(id, text, language, controller.signal)) {
          if (controller.signal.aborted) return

          if (event.type === 'delta') {
            setStream((current) => (current === null ? null : { ...current, text: current.text + event.text }))
          } else if (event.type === 'done') {
            setStream(null)
            void queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(id) })
            void queryClient.invalidateQueries({ queryKey: queryKeys.chat.threads })
          } else if (event.type === 'error') {
            setStream(null)
            setError(event.message)
          }
        }

        // The server closed the stream without a terminal frame.
        setStream(null)
      } catch (cause) {
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