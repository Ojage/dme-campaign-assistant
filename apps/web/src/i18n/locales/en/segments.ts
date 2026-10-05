/** Segment builder and saved-segment list strings. */
export default {
  title: 'Segments',
  description:
    'Turn raw customer data into targetable audiences — stack conditions, see the size live, and save.',
  builder: {
    title: 'Build a segment',
    description: 'Stack conditions — customers must match all of them to be included.',
    name: 'Segment name',
    namePlaceholder: 'e.g. Cameroon high spenders · 30d',
    conditions: 'Conditions',
    addCondition: 'Add condition',
    removeCondition: 'Remove condition',
    audience: 'Estimated audience',
    save: 'Save segment',
    clear: 'Clear',
    saved: 'Saved “{{name}}”.',
    validation: 'Give the segment a name and fill in every condition value.',
    placeholders: {
      amount: 'e.g. 50000',
      transactions: 'e.g. 10',
      days: 'e.g. 30',
      country: 'Select a country',
    },
  },
  operators: {
    gt: 'greater than',
    lt: 'less than',
    eq: 'equals',
    equals: 'equals',
  },
  fields: {
    totalAmountSpent: 'Total amount spent',
    totalTransactions: 'Total transactions',
    lastActivityDays: 'Days since last activity',
    country: 'Country',
  },
  list: {
    title: 'Saved segments',
    description: 'Reusable audiences for campaign targeting.',
    customers: '{{n}} customers',
    created: 'created {{date}}',
    empty: {
      title: 'No segments yet',
      description: 'Build your first segment on the left — it will appear here, ready to target.',
    },
    delete: 'Delete {{name}}',
  },
}
