import type { CatalogSlice } from '../types';

export const componentsBCatalog: CatalogSlice = {
  en: {
    'compb.company.invoiceNumbering': 'Invoice numbering',
    'compb.company.numberingOn': 'On',
    'compb.company.numberingOff': 'Off',
    'compb.company.numberingHint': 'Assign a sequential number to each invoice when it is submitted.',
    'compb.join.fallback': 'Couldn’t join — the invite may be invalid, used or expired.',
    'compb.company.saveFail': 'Could not save company settings.',
    'compb.invites.createFail': 'Could not create the invite.',
    'compb.avatar.uploadFail': 'Could not upload the image. Please try again.',
    'compb.invites.state.pending': 'Pending',
    'compb.invites.state.accepted': 'Accepted',
    'compb.invites.state.revoked': 'Revoked',
    'compb.invites.state.expired': 'Expired',
    // settings/JoinCompanyForm
    'compb.join.codeLabel': 'Invite code or link',
    'compb.join.codePlaceholder': 'Paste your invite link or code',

    // settings/EditCompanyForm — currencies
    'compb.currency.eur': 'EUR — Euro',
    'compb.currency.usd': 'USD — US Dollar',
    'compb.currency.gbp': 'GBP — British Pound',
    'compb.currency.chf': 'CHF — Swiss Franc',
    'compb.currency.cad': 'CAD — Canadian Dollar',
    'compb.currency.aud': 'AUD — Australian Dollar',
    'compb.currency.jpy': 'JPY — Japanese Yen',
    // settings/EditCompanyForm — form
    'compb.company.changeLogo': 'Change logo',
    'compb.company.nameLabel': 'Company name',
    'compb.company.currencyLabel': 'Currency',
    'compb.company.legalNameLabel': 'Legal name (optional)',
    'compb.company.legalNamePlaceholder': 'Registered company name',
    'compb.company.addressLabel': 'Address (optional)',
    'compb.company.addressPlaceholder': 'Billing address',
    'compb.company.vatNumberLabel': 'VAT number (optional)',
    'compb.company.vatNumberPlaceholder': 'e.g. FR12345678901',
    'compb.company.registrationLabel': 'Registration ID (optional)',
    'compb.company.registrationPlaceholder': 'e.g. SIRET',
    'compb.company.vatRateLabel': 'Default VAT rate % (optional)',
    'compb.company.vatRatePlaceholder': 'e.g. 20',
    'compb.company.vatRateError': 'VAT rate must be between 0 and 100',
    'compb.company.save': 'Save company',

    // settings/InvitesCard
    'compb.invites.emailLabel': 'Invite by email',
    'compb.invites.emailPlaceholder': 'teammate@company.com',
    'compb.invites.roleLabel': 'Role',
    'compb.invites.send': 'Send invite',
    'compb.invites.empty': 'No invites yet. Invite teammates by email — they redeem the link to join.',
    'compb.invites.shareMessage': 'Join our team on Chrono: {link}',
    'compb.invites.copied': 'Copied',
    'compb.invites.copyLink': 'Copy link',
    'compb.invites.shareLink': 'Share link',
    'compb.invites.revoke': 'Revoke',

    // settings/AvatarUpload
    'compb.avatar.changePhoto': 'Change photo',

    // settings/ThemeToggle
    'compb.theme.system': 'System',
    'compb.theme.light': 'Light',
    'compb.theme.dark': 'Dark',

    // reports/FreelancerBreakdown
    'compb.reports.noActivity': 'No activity',
    'compb.reports.noActivitySubtitle': 'No approved billable time or invoices in this range.',
    'compb.reports.earned': 'Earned',
    'compb.reports.paid': 'Paid',
    'compb.reports.daysAndDuration': '{days} days · {duration}',
    'compb.reports.noTaggedTime': 'No tagged time in this range.',

    // reports/ProjectPnLCard
    'compb.pnl.revenue': 'Revenue',
    'compb.pnl.referrals': 'Referrals',
    'compb.pnl.fixedCosts': 'Fixed costs',
    'compb.pnl.cost': 'Cost',
    'compb.pnl.expenses': 'Expenses',
    'compb.pnl.margin': 'Margin',
    'compb.pnl.availableFunding': 'Available funding',
    'compb.pnl.dueByClient': 'Due by client',

    // reports/BudgetMeter
    'compb.budget.budget': 'Budget',
    'compb.budget.overBudget': 'Over budget',
    'compb.budget.nearBudget': 'Near budget',
    'compb.budget.usedOf': '{used} of {total}',

    // reports/TrendsCard
    'compb.trends.empty': 'No activity in the last few months yet.',

    // reports/CapacityCard
    'compb.capacity.title': 'Capacity & utilization',
    'compb.capacity.caption': 'Worked days vs. weekly capacity for the selected range.',
    'compb.capacity.overCount': '{n} over capacity',
    'compb.capacity.daysPerWeek': 'Days/week',

    // approvals/ApprovalRow
    'compb.approval.deselect': 'Deselect entry',
    'compb.approval.select': 'Select entry',
    'compb.approval.project': 'Project',
    'compb.approval.reject': 'Reject',
    'compb.approval.approve': 'Approve',

    // approvals/RejectDialog
    'compb.reject.reasonRequired': 'Enter a reason for rejecting',
    'compb.reject.reasonLabel': 'Rejection reason',
    'compb.reject.reasonPlaceholder': 'Why is this entry rejected?',
    'compb.reject.confirm': 'Confirm reject',

    // notifications
    'compb.notif.dismiss': 'Dismiss notification',
    'compb.notif.bell': 'Notifications',
    'compb.notif.bellUnread': 'Notifications, {n} unread',

    // common/LoadMore
    'compb.loadMore.withCount': 'Load more ({n})',
    'compb.loadMore.more': 'Load more',
    'compb.loadMore.loadingMore': 'Loading more…',

    // common/HistoryFilters
    'compb.history.thisMonth': 'This month',
    'compb.history.lastMonth': 'Last month',
    'compb.history.thisWeek': 'This week',
    'compb.history.all': 'All',
    'compb.history.billable': 'Billable',
    'compb.history.nonBillable': 'Non-billable',
    'compb.history.allProjects': 'All projects',
    'compb.history.project': 'Project',
    'compb.history.dateRange': 'Date range',

    // common/ErrorState
    'compb.error.title': 'Something went wrong',

    // auth/AuthForm
    'compb.auth.email': 'Email',
    'compb.auth.emailPlaceholder': 'you@example.com',
    'compb.auth.password': 'Password',
  },
  fr: {
    'compb.company.invoiceNumbering': 'Numérotation des factures',
    'compb.company.numberingOn': 'Activée',
    'compb.company.numberingOff': 'Désactivée',
    'compb.company.numberingHint': 'Attribuer un numéro séquentiel à chaque facture lors de son envoi.',
    'compb.join.fallback': 'Impossible de rejoindre — l’invitation est peut-être invalide, déjà utilisée ou expirée.',
    'compb.company.saveFail': 'Impossible d’enregistrer les paramètres de l’entreprise.',
    'compb.invites.createFail': 'Impossible de créer l’invitation.',
    'compb.avatar.uploadFail': 'Impossible d’envoyer l’image. Veuillez réessayer.',
    'compb.invites.state.pending': 'En attente',
    'compb.invites.state.accepted': 'Acceptée',
    'compb.invites.state.revoked': 'Révoquée',
    'compb.invites.state.expired': 'Expirée',
    // settings/JoinCompanyForm
    'compb.join.codeLabel': 'Code ou lien d’invitation',
    'compb.join.codePlaceholder': 'Collez votre lien ou code d’invitation',

    // settings/EditCompanyForm — currencies
    'compb.currency.eur': 'EUR — Euro',
    'compb.currency.usd': 'USD — Dollar américain',
    'compb.currency.gbp': 'GBP — Livre sterling',
    'compb.currency.chf': 'CHF — Franc suisse',
    'compb.currency.cad': 'CAD — Dollar canadien',
    'compb.currency.aud': 'AUD — Dollar australien',
    'compb.currency.jpy': 'JPY — Yen japonais',
    // settings/EditCompanyForm — form
    'compb.company.changeLogo': 'Changer le logo',
    'compb.company.nameLabel': 'Nom de l’entreprise',
    'compb.company.currencyLabel': 'Devise',
    'compb.company.legalNameLabel': 'Raison sociale (facultatif)',
    'compb.company.legalNamePlaceholder': 'Nom légal de l’entreprise',
    'compb.company.addressLabel': 'Adresse (facultatif)',
    'compb.company.addressPlaceholder': 'Adresse de facturation',
    'compb.company.vatNumberLabel': 'Numéro de TVA (facultatif)',
    'compb.company.vatNumberPlaceholder': 'ex. FR12345678901',
    'compb.company.registrationLabel': 'Numéro d’immatriculation (facultatif)',
    'compb.company.registrationPlaceholder': 'ex. SIRET',
    'compb.company.vatRateLabel': 'Taux de TVA par défaut % (facultatif)',
    'compb.company.vatRatePlaceholder': 'ex. 20',
    'compb.company.vatRateError': 'Le taux de TVA doit être compris entre 0 et 100',
    'compb.company.save': 'Enregistrer l’entreprise',

    // settings/InvitesCard
    'compb.invites.emailLabel': 'Inviter par e-mail',
    'compb.invites.emailPlaceholder': 'collegue@entreprise.com',
    'compb.invites.roleLabel': 'Rôle',
    'compb.invites.send': 'Envoyer l’invitation',
    'compb.invites.empty':
      'Aucune invitation pour l’instant. Invitez vos collègues par e-mail — ils rejoignent via le lien.',
    'compb.invites.shareMessage': 'Rejoignez notre équipe sur Chrono : {link}',
    'compb.invites.copied': 'Copié',
    'compb.invites.copyLink': 'Copier le lien',
    'compb.invites.shareLink': 'Partager le lien',
    'compb.invites.revoke': 'Révoquer',

    // settings/AvatarUpload
    'compb.avatar.changePhoto': 'Changer la photo',

    // settings/ThemeToggle
    'compb.theme.system': 'Système',
    'compb.theme.light': 'Clair',
    'compb.theme.dark': 'Sombre',

    // reports/FreelancerBreakdown
    'compb.reports.noActivity': 'Aucune activité',
    'compb.reports.noActivitySubtitle': 'Aucun temps facturable approuvé ni facture sur cette période.',
    'compb.reports.earned': 'Gagné',
    'compb.reports.paid': 'Payé',
    'compb.reports.daysAndDuration': '{days} jours · {duration}',
    'compb.reports.noTaggedTime': 'Aucun temps étiqueté sur cette période.',

    // reports/ProjectPnLCard
    'compb.pnl.revenue': 'Revenus',
    'compb.pnl.referrals': 'Parrainages',
    'compb.pnl.fixedCosts': 'Coûts fixes',
    'compb.pnl.cost': 'Coût',
    'compb.pnl.expenses': 'Dépenses',
    'compb.pnl.margin': 'Marge',
    'compb.pnl.availableFunding': 'Financement disponible',
    'compb.pnl.dueByClient': 'Dû par le client',

    // reports/BudgetMeter
    'compb.budget.budget': 'Budget',
    'compb.budget.overBudget': 'Dépassement de budget',
    'compb.budget.nearBudget': 'Proche du budget',
    'compb.budget.usedOf': '{used} sur {total}',

    // reports/CapacityCard
    'compb.capacity.title': 'Capacité et utilisation',
    'compb.capacity.caption': 'Jours travaillés vs capacité hebdomadaire sur la période sélectionnée.',
    'compb.capacity.overCount': '{n} en surcapacité',
    'compb.capacity.daysPerWeek': 'Jours/semaine',

    // reports/TrendsCard
    'compb.trends.empty': 'Aucune activité au cours des derniers mois.',

    // approvals/ApprovalRow
    'compb.approval.deselect': 'Désélectionner l’entrée',
    'compb.approval.select': 'Sélectionner l’entrée',
    'compb.approval.project': 'Projet',
    'compb.approval.reject': 'Rejeter',
    'compb.approval.approve': 'Approuver',

    // approvals/RejectDialog
    'compb.reject.reasonRequired': 'Saisissez un motif de rejet',
    'compb.reject.reasonLabel': 'Motif du rejet',
    'compb.reject.reasonPlaceholder': 'Pourquoi cette entrée est-elle rejetée ?',
    'compb.reject.confirm': 'Confirmer le rejet',

    // notifications
    'compb.notif.dismiss': 'Ignorer la notification',
    'compb.notif.bell': 'Notifications',
    'compb.notif.bellUnread': 'Notifications, {n} non lues',

    // common/LoadMore
    'compb.loadMore.withCount': 'Afficher plus ({n})',
    'compb.loadMore.more': 'Afficher plus',
    'compb.loadMore.loadingMore': 'Chargement…',

    // common/HistoryFilters
    'compb.history.thisMonth': 'Ce mois-ci',
    'compb.history.lastMonth': 'Le mois dernier',
    'compb.history.thisWeek': 'Cette semaine',
    'compb.history.all': 'Tous',
    'compb.history.billable': 'Facturable',
    'compb.history.nonBillable': 'Non facturable',
    'compb.history.allProjects': 'Tous les projets',
    'compb.history.project': 'Projet',
    'compb.history.dateRange': 'Période',

    // common/ErrorState
    'compb.error.title': 'Une erreur est survenue',

    // auth/AuthForm
    'compb.auth.email': 'E-mail',
    'compb.auth.emailPlaceholder': 'vous@exemple.com',
    'compb.auth.password': 'Mot de passe',
  },
};
