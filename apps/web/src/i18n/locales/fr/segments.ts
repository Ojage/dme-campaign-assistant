/** Chaînes du créateur de segments et de la liste des segments enregistrés. */
export default {
  title: 'Segments',
  description:
    'Transformez les données clients en audiences ciblables — cumulez les conditions, visualisez la taille en direct et enregistrez.',
  builder: {
    title: 'Créer un segment',
    description: 'Cumulez les conditions — les clients doivent répondre à toutes pour être inclus.',
    name: 'Nom du segment',
    namePlaceholder: 'ex. Grands dépensiers Cameroun · 30j',
    conditions: 'Conditions',
    addCondition: 'Ajouter une condition',
    removeCondition: 'Supprimer la condition',
    audience: 'Audience estimée',
    save: 'Enregistrer le segment',
    clear: 'Effacer',
    saved: '« {{name}} » enregistré.',
    validation: 'Donnez un nom au segment et renseignez chaque condition.',
    placeholders: {
      amount: 'ex. 50000',
      transactions: 'ex. 10',
      days: 'ex. 30',
      country: 'Choisir un pays',
    },
  },
  operators: {
    gt: 'supérieur à',
    lt: 'inférieur à',
    eq: 'égal à',
    equals: 'égal à',
  },
  fields: {
    totalAmountSpent: 'Montant total dépensé',
    totalTransactions: 'Transactions au total',
    lastActivityDays: 'Jours depuis la dernière activité',
    country: 'Pays',
  },
  list: {
    title: 'Segments enregistrés',
    description: 'Audiences réutilisables pour le ciblage des campagnes.',
    customers: '{{n}} clients',
    created: 'créé le {{date}}',
    empty: {
      title: 'Aucun segment pour le moment',
      description: 'Créez votre premier segment à gauche — il apparaîtra ici, prêt à cibler.',
    },
    delete: 'Supprimer {{name}}',
  },
}
