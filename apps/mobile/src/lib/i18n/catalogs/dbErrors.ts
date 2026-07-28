import type { CatalogSlice } from '../types';

/**
 * Messages for the slugs raised by DB functions (`raise exception 'slug'`, see
 * the error-slug migration). A slug the catalog does not know falls back to the
 * generic error copy, so a new DB error never shows its raw slug to a user.
 * Values the DB appends to a slug arrive as `{0}`, `{1}`, … in order.
 */
export const dbErrorsCatalog: CatalogSlice = {
  en: {
    // Roles and members
    'db.role-admin-grant-forbidden': 'Only an admin can grant or change the admin role.',
    'db.role-change-forbidden': 'Only an admin can change your role.',
    'db.seat-limit-reached':
      'This company has reached its plan seat limit ({0}). Ask an admin to upgrade.',

    // Invites
    'db.invite-identity-immutable': "An invite's email, role and company cannot be changed.",
    'db.invite-role-forbidden': 'Only an admin can invite a manager or an admin.',

    // Time entries
    'db.time-entry-invoiced-locked': 'This time entry is already invoiced and can no longer be edited.',
    'db.capacity-exceeded': 'Monthly capacity exceeded (22 × {0}h).',
    'db.vacation-allowance-exceeded': 'Vacation allowance exceeded ({0} days per year).',
    'db.time-net-negative-delete': 'Deleting this entry would leave negative net time for this project month.',
    'db.time-net-negative-remove': 'Removing this entry would leave negative net time for this project month.',
    'db.time-net-negative-correction': 'This correction would leave negative net time for this project month.',

    // Invoices
    'db.invoice-company-mismatch': 'This invoice does not belong to its project company.',
    'db.invoice-foreign-user': 'You cannot write an invoice for another user.',
    'db.invoice-invalid-project': 'That project is not valid for this invoice.',
    'db.invoice-freelancer-status-forbidden': 'Freelancers can only draft or submit an invoice.',
    'db.invoice-settlement-status-reserved': 'Settlement statuses are set by the monthly settlement, not by hand.',
    'db.invoice-settled-immutable': 'A settled invoice can only be cancelled, not reverted.',

    // Projects, revenue and costs
    'db.project-not-found': 'Project not found.',
    'db.company-not-found': 'Company not found.',
    'db.revenue-source-not-found': 'Revenue source not found.',
    'db.revenue-recognize-forbidden': 'Only a manager can recognize revenue.',
    'db.revenue-correct-forbidden': 'Only a manager can correct revenue.',
    'db.revenue-paid-forbidden': 'Only a manager can mark revenue as paid.',
    'db.revenue-entries-not-found': 'No matching revenue entries.',
    'db.revenue-entries-multi-company': 'Revenue entries must all belong to the same company.',
    'db.revenue-net-negative-delete': 'Deleting this entry would leave negative net revenue for this project month.',
    'db.revenue-net-negative-remove': 'Removing this entry would leave negative net revenue for this project month.',
    'db.revenue-net-negative-correction': 'This correction would leave negative net revenue for this project month.',
    'db.project-costs-not-found': 'No matching project costs.',
    'db.project-costs-multi-company': 'Project costs must all belong to the same company.',
    'db.project-costs-paid-forbidden': 'Only a manager can mark project costs as paid.',
    'db.project-cost-reimbursable-not-payable':
      'A reimbursable cost is settled by reimbursing it, not by marking it paid.',
    'db.referral-total-exceeded': 'Referral shares cannot exceed 100% for a project (this would reach {0}%).',
    'db.settle-forbidden': 'Only a manager can settle a project month.',

    // Remuneration
    'db.rem-compute-forbidden': 'Only a manager can compute the remuneration month.',
    'db.rem-lock-forbidden': 'Only a manager can lock the remuneration month.',
    'db.rem-month-locked': 'This remuneration month is locked.',
    'db.rem-month-not-computed': 'This remuneration month has not been computed yet.',
    'db.rem-license-recipients-invalid':
      'License distribution needs exactly two license recipients ({0} found).',

    // Company settings
    'db.working-weekdays-empty': 'Pick at least one working day.',
    'db.working-weekdays-out-of-range': 'Working days must be between Monday and Sunday.',
    'db.working-weekdays-duplicate': 'A working day cannot be listed twice.',
    'db.product-pool-project-invalid': 'Pick an active product pool project from this company.',
  },
  fr: {
    // Rôles et membres
    'db.role-admin-grant-forbidden': 'Seul un admin peut attribuer ou modifier le rôle admin.',
    'db.role-change-forbidden': 'Seul un admin peut modifier votre rôle.',
    'db.seat-limit-reached':
      'Cette entreprise a atteint la limite de sièges de son forfait ({0}). Demandez à un admin de le faire évoluer.',

    // Invitations
    'db.invite-identity-immutable':
      "L'e-mail, le rôle et l'entreprise d'une invitation ne peuvent pas être modifiés.",
    'db.invite-role-forbidden': 'Seul un admin peut inviter un manager ou un admin.',

    // Saisies de temps
    'db.time-entry-invoiced-locked': 'Cette saisie est déjà facturée et ne peut plus être modifiée.',
    'db.capacity-exceeded': 'Capacité mensuelle dépassée (22 × {0} h).',
    'db.vacation-allowance-exceeded': 'Solde de congés dépassé ({0} jours par an).',
    'db.time-net-negative-delete':
      'Supprimer cette saisie rendrait le temps net négatif pour ce mois de projet.',
    'db.time-net-negative-remove':
      'Retirer cette saisie rendrait le temps net négatif pour ce mois de projet.',
    'db.time-net-negative-correction':
      'Cette correction rendrait le temps net négatif pour ce mois de projet.',

    // Factures
    'db.invoice-company-mismatch': "Cette facture n'appartient pas à l'entreprise de son projet.",
    'db.invoice-foreign-user': 'Vous ne pouvez pas créer de facture pour un autre utilisateur.',
    'db.invoice-invalid-project': "Ce projet n'est pas valide pour cette facture.",
    'db.invoice-freelancer-status-forbidden':
      'Un freelance peut seulement mettre une facture en brouillon ou la soumettre.',
    'db.invoice-settlement-status-reserved':
      'Les statuts de règlement sont définis par le règlement mensuel, pas manuellement.',
    'db.invoice-settled-immutable': 'Une facture réglée peut seulement être annulée, pas rétablie.',

    // Projets, revenus et coûts
    'db.project-not-found': 'Projet introuvable.',
    'db.company-not-found': 'Entreprise introuvable.',
    'db.revenue-source-not-found': 'Source de revenu introuvable.',
    'db.revenue-recognize-forbidden': 'Seul un manager peut constater du revenu.',
    'db.revenue-correct-forbidden': 'Seul un manager peut corriger un revenu.',
    'db.revenue-paid-forbidden': 'Seul un manager peut marquer un revenu comme payé.',
    'db.revenue-entries-not-found': 'Aucune écriture de revenu correspondante.',
    'db.revenue-entries-multi-company':
      'Les écritures de revenu doivent toutes appartenir à la même entreprise.',
    'db.revenue-net-negative-delete':
      'Supprimer cette écriture rendrait le revenu net négatif pour ce mois de projet.',
    'db.revenue-net-negative-remove':
      'Retirer cette écriture rendrait le revenu net négatif pour ce mois de projet.',
    'db.revenue-net-negative-correction':
      'Cette correction rendrait le revenu net négatif pour ce mois de projet.',
    'db.project-costs-not-found': 'Aucun coût de projet correspondant.',
    'db.project-costs-multi-company':
      'Les coûts de projet doivent tous appartenir à la même entreprise.',
    'db.project-costs-paid-forbidden':
      'Seul un manager peut marquer des coûts de projet comme payés.',
    'db.project-cost-reimbursable-not-payable':
      'Un coût remboursable se règle par un remboursement, pas en le marquant payé.',
    'db.referral-total-exceeded':
      "Les parts d'apport d'affaires ne peuvent pas dépasser 100 % sur un projet (ce changement atteindrait {0} %).",
    'db.settle-forbidden': 'Seul un manager peut clôturer un mois de projet.',

    // Rémunération
    'db.rem-compute-forbidden': 'Seul un manager peut calculer le mois de rémunération.',
    'db.rem-lock-forbidden': 'Seul un manager peut verrouiller le mois de rémunération.',
    'db.rem-month-locked': 'Ce mois de rémunération est verrouillé.',
    'db.rem-month-not-computed': "Ce mois de rémunération n'a pas encore été calculé.",
    'db.rem-license-recipients-invalid':
      'La répartition de licence nécessite exactement deux bénéficiaires ({0} trouvés).',

    // Paramètres d'entreprise
    'db.working-weekdays-empty': 'Choisissez au moins un jour travaillé.',
    'db.working-weekdays-out-of-range': 'Les jours travaillés doivent être compris entre lundi et dimanche.',
    'db.working-weekdays-duplicate': 'Un jour travaillé ne peut pas être listé deux fois.',
    'db.product-pool-project-invalid': 'Choisissez un projet de pool produit actif de cette entreprise.',
  },
};
