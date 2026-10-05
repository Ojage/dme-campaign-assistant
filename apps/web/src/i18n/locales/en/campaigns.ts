/** Campaign composer, generated result, and history strings. */
export default {
  title: 'Campaigns',
  description:
    'Pick an audience and a voice — get a ready-to-send title, message, and call to action in seconds.',
  form: {
    title: 'Compose campaign',
    description: 'Pick an audience, channel, and tone — the assistant writes the copy.',
    segment: 'Audience segment',
    segmentPlaceholder: 'Choose a segment',
    objective: 'Campaign objective',
    objectivePlaceholder: 'e.g. Drive repeat purchases with an exclusive weekend offer',
    channel: 'Channel',
    tone: 'Tone',
    generate: 'Generate campaign',
    generating: 'Writing copy…',
    validation: 'Pick a segment and describe the campaign objective first.',
    channels: {
      sms: 'SMS',
      email: 'Email',
      push: 'Push',
    },
    channelHints: {
      sms: 'Short, instant, high open rate',
      email: 'Longer form, rich formatting',
      push: 'One-line nudge, app users',
    },
    tones: {
      professional: 'Professional',
      friendly: 'Friendly',
      urgent: 'Urgent',
      promotional: 'Promotional',
    },
  },
  result: {
    message: 'Message',
    callToAction: 'Call to action',
    copy: 'Copy',
    copied: 'Copied',
    approve: 'Approve & queue',
    targeting: 'Targeting “{{segment}}”',
    generatedAt: 'generated {{date}}',
  },
  recent: {
    title: 'Recent campaigns',
    description: 'Everything generated in this session.',
    none: 'No campaigns generated yet.',
  },
}
