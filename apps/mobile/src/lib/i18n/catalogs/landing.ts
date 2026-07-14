import type { CatalogSlice } from '../types';

// Translations for the "landing" area. Keys are namespaced "landing.*",
// "onboarding.*" and "auth.*".
export const landingCatalog: CatalogSlice = {
  en: {
    // ─── Landing marketing page ───
    'landing.hero.tagline': 'Track freelance time, recognize revenue, and get everyone paid.',
    'landing.hero.blurb':
      'Chrono is the time-tracking and invoicing workspace for companies running multiple freelancers across multiple projects — with approvals, revenue sources, referrals and funding-aware settlement handled end to end.',
    'landing.hero.getStarted': 'Get started',
    'landing.hero.trust': 'Multi-tenant · Offline-first · iOS · Android · Web',

    'landing.features.eyebrow': 'Why Chrono',
    'landing.features.title': 'Everything from a logged hour\nto a settled invoice.',
    'landing.feature.logTime.title': 'Log time your way',
    'landing.feature.logTime.body':
      'Enter hours against the projects you are assigned to. Days and amounts are computed from each project rate.',
    'landing.feature.approvals.title': 'Approvals built in',
    'landing.feature.approvals.body':
      'Managers review and approve logged time before a single euro is billed. Nothing slips through.',
    'landing.feature.invoices.title': 'Invoices & carry-forward',
    'landing.feature.invoices.body':
      'Turn approved time into monthly invoices. When funding is short, the balance is credited to the next period automatically.',
    'landing.feature.revenue.title': 'Revenue sources',
    'landing.feature.revenue.body':
      'Fund projects from time & materials contracts, recurring retainers or self-billing — recognized month by month.',
    'landing.feature.referral.title': 'Referral earnings',
    'landing.feature.referral.body':
      'Bring a client and earn a share of project revenue every period — paid off the top before anyone else settles.',
    'landing.feature.companies.title': 'Multiple companies',
    'landing.feature.companies.body':
      'One account, many companies. Switch between the teams you work with and keep every project cleanly separated.',

    'landing.how.eyebrow': 'How it works',
    'landing.how.title': 'Four steps, one clear flow.',
    'landing.step.log.title': 'Log hours',
    'landing.step.log.body': 'Freelancers record time against their assigned projects.',
    'landing.step.approve.title': 'Approve',
    'landing.step.approve.body': 'Managers approve billable time for the month.',
    'landing.step.invoice.title': 'Invoice',
    'landing.step.invoice.body': 'Approved time becomes a monthly invoice at each freelancer’s rate.',
    'landing.step.settle.title': 'Settle',
    'landing.step.settle.body': 'Invoices are paid from recognized project revenue, FIFO.',

    'landing.cta.title': 'Ready to bill your time?',
    'landing.cta.subtitle': 'Set up your company and first project in minutes.',

    'landing.footer.copyright': '© {year} Drakkar Software',

    // ─── Not found ───
    'landing.notFound.title': 'Not found',
    'landing.notFound.emptyTitle': "This page doesn't exist",
    'landing.notFound.emptySubtitle': 'The link may be broken or the page may have moved.',
    'landing.notFound.goHome': 'Go home',

    // ─── Auth ───
    'auth.signIn': 'Sign in',
    'auth.signUp': 'Sign up',
    'auth.createAccount': 'Create your account',
    'auth.login.title': 'Welcome back',
    'auth.login.subtitle': 'Sign in to your Chrono account',
    'auth.login.createAccount': 'Create an account',
    'auth.login.forgotPassword': 'Forgot your password?',
    'auth.register.subtitle': 'Start tracking your time',
    'auth.register.checkInbox': 'Check your inbox to confirm your email.',
    'auth.register.haveAccount': 'Already have an account? Sign in',
    'auth.reset.title': 'Reset your password',
    'auth.reset.subtitle': 'Enter your email to get a reset link',
    'auth.reset.sent': 'If that email exists, a reset link is on its way.',
    'auth.reset.submit': 'Send reset link',
    'auth.reset.backToSignIn': 'Back to sign in',
    'auth.join.title': 'Joining…',
    'auth.join.missingCode': 'This invite link is missing its code.',
    'auth.join.error': "Couldn't join",

    // ─── Onboarding ───
    'onboarding.role.title': 'Set up Chrono',
    'onboarding.role.subtitleJoin':
      'Step 1 of 1 · Enter your name and the code your team shared to join.',
    'onboarding.role.subtitleCreate':
      'Step 1 of 1 · Tell us who you are and name your company to get started.',
    'onboarding.role.optCreate': 'Create a company',
    'onboarding.role.optJoin': 'Join with a code',
    'onboarding.role.nameLabel': 'Your name',
    'onboarding.role.namePlaceholder': 'Jane Doe',
    'onboarding.role.codeLabel': 'Company code',
    'onboarding.role.codePlaceholder': 'Paste the code from your manager',
    'onboarding.role.companyLabel': 'Company name',
    'onboarding.role.companyPlaceholder': 'Acme Studio',
    'onboarding.role.joinBtn': 'Join company',
    'onboarding.role.createBtn': 'Create company',
    'onboarding.role.errName': 'Enter your name',
    'onboarding.role.errCompanyName': 'Enter a company name',
    'onboarding.role.errCompanyCode': 'Enter a company code',
    'onboarding.role.errJoin': "Couldn't join — check the code and try again.",
    'onboarding.role.errGeneric': 'Something went wrong',
  },
  fr: {
    // ─── Landing marketing page ───
    'landing.hero.tagline':
      'Suivez le temps des freelances, constatez les revenus et assurez le paiement de tous.',
    'landing.hero.blurb':
      "Chrono est l'espace de suivi du temps et de facturation pour les entreprises qui gèrent plusieurs freelances sur plusieurs projets — avec approbations, sources de revenus, parrainages et règlement tenant compte du financement, gérés de bout en bout.",
    'landing.hero.getStarted': 'Commencer',
    'landing.hero.trust': "Multi-entreprises · Hors ligne d'abord · iOS · Android · Web",

    'landing.features.eyebrow': 'Pourquoi Chrono',
    'landing.features.title': "De l'heure saisie\nà la facture réglée.",
    'landing.feature.logTime.title': 'Saisissez votre temps à votre façon',
    'landing.feature.logTime.body':
      'Saisissez des heures sur les projets qui vous sont attribués. Les jours et les montants sont calculés à partir du taux de chaque projet.',
    'landing.feature.approvals.title': 'Approbations intégrées',
    'landing.feature.approvals.body':
      "Les managers vérifient et approuvent le temps saisi avant qu'un seul euro ne soit facturé. Rien ne passe entre les mailles.",
    'landing.feature.invoices.title': 'Factures et report',
    'landing.feature.invoices.body':
      'Transformez le temps approuvé en factures mensuelles. Lorsque le financement est insuffisant, le solde est reporté automatiquement sur la période suivante.',
    'landing.feature.revenue.title': 'Sources de revenus',
    'landing.feature.revenue.body':
      "Financez les projets par des contrats en régie, des forfaits récurrents ou l'auto-facturation — constatés mois après mois.",
    'landing.feature.referral.title': 'Gains de parrainage',
    'landing.feature.referral.body':
      'Amenez un client et gagnez une part des revenus du projet à chaque période — versée en priorité, avant tout autre règlement.',
    'landing.feature.companies.title': 'Plusieurs entreprises',
    'landing.feature.companies.body':
      "Un seul compte, plusieurs entreprises. Passez d'une équipe à l'autre et gardez chaque projet clairement séparé.",

    'landing.how.eyebrow': 'Comment ça marche',
    'landing.how.title': 'Quatre étapes, un flux limpide.',
    'landing.step.log.title': 'Saisir les heures',
    'landing.step.log.body':
      'Les freelances enregistrent leur temps sur les projets qui leur sont attribués.',
    'landing.step.approve.title': 'Approuver',
    'landing.step.approve.body': 'Les managers approuvent le temps facturable du mois.',
    'landing.step.invoice.title': 'Facturer',
    'landing.step.invoice.body':
      'Le temps approuvé devient une facture mensuelle au taux de chaque freelance.',
    'landing.step.settle.title': 'Régler',
    'landing.step.settle.body':
      'Les factures sont payées à partir des revenus de projet constatés, en FIFO.',

    'landing.cta.title': 'Prêt à facturer votre temps ?',
    'landing.cta.subtitle': 'Configurez votre entreprise et votre premier projet en quelques minutes.',

    'landing.footer.copyright': '© {year} Drakkar Software',

    // ─── Not found ───
    'landing.notFound.title': 'Introuvable',
    'landing.notFound.emptyTitle': "Cette page n'existe pas",
    'landing.notFound.emptySubtitle': 'Le lien est peut-être rompu ou la page a été déplacée.',
    'landing.notFound.goHome': "Retour à l'accueil",

    // ─── Auth ───
    'auth.signIn': 'Se connecter',
    'auth.signUp': "S'inscrire",
    'auth.createAccount': 'Créez votre compte',
    'auth.login.title': 'Bon retour',
    'auth.login.subtitle': 'Connectez-vous à votre compte Chrono',
    'auth.login.createAccount': 'Créer un compte',
    'auth.login.forgotPassword': 'Mot de passe oublié ?',
    'auth.register.subtitle': 'Commencez à suivre votre temps',
    'auth.register.checkInbox': 'Consultez votre boîte de réception pour confirmer votre e-mail.',
    'auth.register.haveAccount': 'Vous avez déjà un compte ? Connectez-vous',
    'auth.reset.title': 'Réinitialisez votre mot de passe',
    'auth.reset.subtitle': 'Saisissez votre e-mail pour recevoir un lien de réinitialisation',
    'auth.reset.sent': 'Si cette adresse e-mail existe, un lien de réinitialisation est en route.',
    'auth.reset.submit': 'Envoyer le lien de réinitialisation',
    'auth.reset.backToSignIn': 'Retour à la connexion',
    'auth.join.title': 'Adhésion en cours…',
    'auth.join.missingCode': "Ce lien d'invitation ne contient pas de code.",
    'auth.join.error': 'Impossible de rejoindre',

    // ─── Onboarding ───
    'onboarding.role.title': 'Configurer Chrono',
    'onboarding.role.subtitleJoin':
      'Étape 1 sur 1 · Saisissez votre nom et le code partagé par votre équipe pour la rejoindre.',
    'onboarding.role.subtitleCreate':
      'Étape 1 sur 1 · Dites-nous qui vous êtes et nommez votre entreprise pour commencer.',
    'onboarding.role.optCreate': 'Créer une entreprise',
    'onboarding.role.optJoin': 'Rejoindre avec un code',
    'onboarding.role.nameLabel': 'Votre nom',
    'onboarding.role.namePlaceholder': 'Jean Dupont',
    'onboarding.role.codeLabel': "Code de l'entreprise",
    'onboarding.role.codePlaceholder': 'Collez le code fourni par votre manager',
    'onboarding.role.companyLabel': "Nom de l'entreprise",
    'onboarding.role.companyPlaceholder': 'Acme Studio',
    'onboarding.role.joinBtn': "Rejoindre l'entreprise",
    'onboarding.role.createBtn': "Créer l'entreprise",
    'onboarding.role.errName': 'Saisissez votre nom',
    'onboarding.role.errCompanyName': "Saisissez un nom d'entreprise",
    'onboarding.role.errCompanyCode': "Saisissez un code d'entreprise",
    'onboarding.role.errJoin': 'Impossible de rejoindre — vérifiez le code et réessayez.',
    'onboarding.role.errGeneric': "Une erreur s'est produite",
  },
};
