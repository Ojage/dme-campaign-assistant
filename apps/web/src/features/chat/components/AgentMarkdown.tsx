import { Fragment, memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  hrefIfSafe,
  parseBlocks,
  parseInline,
  splitStreamingLines,
  URL_PATTERN,
} from '@/features/chat/lib/markdown'
import type {
  InlinePart,
  MarkdownBlock,
} from '@/features/chat/lib/markdown'

const blockGap = 'space-y-2'

function InlineRuns({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        switch (part.kind) {
          case 'strong':
            return (
              <strong key={index} className="font-semibold">
                {part.value}
              </strong>
            )
          case 'em':
            return <em key={index}>{part.value}</em>
          case 'strike':
            return (
              <del key={index} className="text-foreground/80 line-through">
                {part.value}
              </del>
            )
          case 'code':
            return (
              <code
                key={index}
                className="rounded bg-background/60 px-1 py-0.5 font-mono text-[0.85em] text-foreground"
              >
                {part.value}
              </code>
            )
          case 'link': {
            const href = hrefIfSafe(part.href)
            return href === null ? (
              <a key={index}>{part.value}</a>
            ) : (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
              >
                {part.value}
              </a>
            )
          }
          case 'text': {
            const urlSegments = part.value.split(URL_PATTERN)
            return (
              <Fragment key={index}>
                {urlSegments.map((segment, i) => {
                  if (i % 2 === 1) {
                    const safe = hrefIfSafe(segment)
                    return safe === null ? (
                      <Fragment key={i}>{segment}</Fragment>
                    ) : (
                      <a
                        key={i}
                        href={safe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
                      >
                        {segment}
                      </a>
                    )
                  }
                  return <Fragment key={i}>{segment}</Fragment>
                })}
              </Fragment>
            )
          }
        }
      })}
    </>
  )
}

function Inline({ text }: { text: string }) {
  const parts = useMemo(() => parseInline(text), [text])
  return <InlineRuns parts={parts} />
}

function Block({ block }: { block: MarkdownBlock }) {
  switch (block.type) {
    case 'heading':
      return block.level === 1 ? (
        <p className="pt-0.5 text-[15px] font-bold leading-snug">
          <Inline text={block.text} />
        </p>
      ) : block.level === 2 ? (
        <p className="pt-0.5 text-sm font-bold leading-snug">
          <Inline text={block.text} />
        </p>
      ) : (
        <p className="pt-0.5 text-[13px] font-semibold leading-snug">
          <Inline text={block.text} />
        </p>
      )
    case 'list':
      return (
        <ul className={cn('space-y-1.5', block.items.length > 1 && 'pl-0.5')}>
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span
                className={cn(
                  'mt-px select-none',
                  block.ordered ? 'min-w-[1.1rem] text-right font-medium' : 'w-2.5',
                )}
                aria-hidden="true"
              >
                {block.ordered ? `${index + 1}.` : '•'}
              </span>
              <span className="min-w-0 flex-1">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="border-l-2 border-foreground/15 pl-3 italic text-muted-foreground">
          {block.lines.map((line, index) => (
            <p key={index} className={cn(index > 0 && 'mt-1')}>
              <Inline text={line} />
            </p>
          ))}
        </blockquote>
      )
    case 'code':
      return (
        <pre
          className="overflow-x-auto rounded-lg bg-background/60 px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground"
          role="region"
          aria-label={block.lang ?? 'code'}
        >
          {block.code}
        </pre>
      )
    case 'hr':
      return <div className="h-px bg-border" />
    case 'paragraph':
      return (
        <p>
          {block.lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 ? <br /> : null}
              <Inline text={line} />
            </Fragment>
          ))}
        </p>
      )
  }
}

/**
 * Renders the assistant's Markdown. Whole lines are formatted; the trailing partial
 * line of a live stream stays plain with a caret so no half-finished syntax flashes.
 */
export const AgentMarkdown = memo(function AgentMarkdown({
  text,
  streaming,
}: {
  text: string
  streaming?: boolean
}) {
  const { complete, pending } = useMemo(
    () => splitStreamingLines(text, streaming === true),
    [text, streaming],
  )
  const blocks = useMemo(() => parseBlocks(complete), [complete])

  return (
    <div className={cn(blockGap, 'min-w-0', streaming === true && 'pr-0.5')}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}

      {pending !== null ? (
        <p className="whitespace-pre-wrap text-foreground/80">
          {pending}
          <span
            className="animate-pulse font-medium text-primary"
            aria-hidden="true"
          >
            ▍
          </span>
        </p>
      ) : null}
    </div>
  )
})