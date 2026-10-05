import { Campaign, assertChannel, type CampaignContext } from './campaign.entity'
import { ConflictError, ModelProviderError, ValidationError } from '../../../shared/domain/domain.errors'

/**
 * A campaign only reaches a customer through this state machine, so the legal
 * moves are asserted here rather than only through HTTP.
 */

const CONTEXT: CampaignContext = {
  segmentId: 'segment-1',
  segmentName: 'Recent spenders',
  channel: 'sms',
  tone: 'friendly',
  objective: 'Drive app installs',
}

const DRAFT = {
  title: 'Install the app',
  message: 'Get the app today.',
  callToAction: 'Install now',
  tone: 'friendly' as const,
  language: 'en' as const,
}

function draft() {
  return Campaign.fromDraft(DRAFT, CONTEXT)
}

describe('creating a campaign', () => {
  it('starts every generated campaign as a draft', () => {
    expect(draft().status).toBe('draft')
  })

  it('carries the target segment and objective from the request', () => {
    const campaign = draft()
    expect(campaign.segmentId).toBe('segment-1')
    expect(campaign.objective).toBe('Drive app installs')
    expect(campaign.channel).toBe('sms')
  })

  it('truncates copy that exceeds the channel limit, on a word boundary', () => {
    const long = 'word '.repeat(80)
    const sms = Campaign.fromDraft({ ...DRAFT, message: long }, CONTEXT)

    expect(sms.message.length).toBeLessThan(long.length)
    expect(sms.message.endsWith(' ')).toBe(false)
  })

  it('reports unusable copy as a model failure, not a validation error', () => {
    // The request itself was valid; the assistant is what came back unusable, so
    // the caller is told to retry the generation rather than to fix their input.
    expect(() => Campaign.fromDraft({ ...DRAFT, title: '   ' }, CONTEXT)).toThrow(ModelProviderError)
  })

  it('accepts only the supported channels', () => {
    expect(assertChannel('email')).toBe('email')
    expect(() => assertChannel('carrier-pigeon')).toThrow(ValidationError)
  })
})

describe('status transitions', () => {
  it('walks draft → ready → sent', () => {
    const campaign = draft()
    campaign.changeStatus('ready')
    expect(campaign.status).toBe('ready')
    campaign.changeStatus('sent')
    expect(campaign.status).toBe('sent')
  })

  it('treats a repeated status as a no-op', () => {
    const campaign = draft()
    campaign.changeStatus('draft')
    expect(campaign.status).toBe('draft')
  })

  it('never sends a campaign that a human has not readied', () => {
    expect(() => draft().changeStatus('sent')).toThrow(ConflictError)
  })

  it('refuses to un-send a campaign that already went out', () => {
    const campaign = draft()
    campaign.changeStatus('ready')
    campaign.changeStatus('sent')
    expect(() => campaign.changeStatus('draft')).toThrow(ConflictError)
  })

  it('allows a ready campaign to be pulled back to draft before sending', () => {
    const campaign = draft()
    campaign.changeStatus('ready')
    campaign.changeStatus('draft')
    expect(campaign.status).toBe('draft')
  })
})