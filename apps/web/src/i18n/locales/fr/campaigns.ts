/** Chaînes du composeur de campagnes, du résultat généré et de l’historique. */
export default {
  title: 'Campagnes',
  description:
    'Choisissez une audience et un ton — obtenez un titre, un message et un appel à l’action prêts à envoyer en quelques secondes.',
  form: {
    title: 'Composer une campagne',
    description: 'Choisissez l’audience, le canal et le ton — l’assistant rédige le contenu.',
    segment: 'Segment d’audience',
    segmentPlaceholder: 'Choisir un segment',
    objective: 'Objectif de la campagne',
    objectivePlaceholder: 'ex. Stimuler les achats répétés avec une offre exclusive de week-end',
    channel: 'Canal',
    tone: 'Ton',
    generate: 'Générer la campagne',
    generating: 'Rédaction en cours…',
    validation: 'Choisissez un segment et décrivez d’abord l’objectif de la campagne.',
    channels: {
      sms: 'SMS',
      email: 'E-mail',
      push: 'Notification push',
    },
    channelHints: {
      sms: 'Court, instantané, fort taux d’ouverture',
      email: 'Format long, mise en forme riche',
      push: 'Rappel d’une ligne, utilisateurs de l’app',
    },
    tones: {
      professional: 'Professionnel',
      friendly: 'Amical',
      urgent: 'Urgent',
      promotional: 'Promotionnel',
    },
  },
  result: {
    message: 'Message',
    callToAction: 'Appel à l’action',
    copy: 'Copier',
    copied: 'Copié',
    approve: 'Approuver & mettre en file',
    targeting: 'Cible : « {{segment}} »',
    generatedAt: 'généré le {{date}}',
  },
  recent: {
    title: 'Campagnes récentes',
    description: 'Tout ce qui a été généré dans cette session.',
    none: 'Aucune campagne générée pour le moment.',
  },
}
