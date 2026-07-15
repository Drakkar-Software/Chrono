-- ============================================================================
-- Blog — public, SEO-oriented marketing articles
--
-- Public-read (anon + authenticated) but ONLY for published, non-deleted rows,
-- so drafts never leak. Content is a jsonb bag of per-locale translations
-- (title / excerpt / body markdown) mirroring the rest of the app's i18n, plus
-- an optional SEO meta-description per locale. Rendered server-side by Expo
-- Router static export so crawlers get real HTML.
-- ============================================================================

create type public.blog_article_status as enum ('draft', 'published');

create table public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  -- { title_translations, excerpt_translations, content_translations,
  --   description_translations } — each a { [locale]: string } map.
  content jsonb not null default '{}'::jsonb,
  author text not null default 'Chrono',
  image_url text,
  status public.blog_article_status not null default 'draft',
  read_time integer,
  keywords text[],
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted boolean default false
);

alter table public.blog_articles enable row level security;

-- Anyone (signed-out crawlers included) may read PUBLISHED, non-deleted articles.
create policy "Published blog articles are publicly readable"
  on public.blog_articles for select
  to anon, authenticated
  using (status = 'published' and deleted = false);

create index blog_articles_published_idx
  on public.blog_articles (published_at desc)
  where status = 'published' and deleted = false;

create trigger blog_articles_updated_at
  before update on public.blog_articles
  for each row execute function public.update_updated_at_column();

-- ── Seed: three launch articles (EN + FR), SEO-oriented around the product ──
insert into public.blog_articles (slug, status, author, read_time, published_at, keywords, image_url, content) values
(
  'from-logged-hours-to-paid-invoices',
  'published', 'Chrono', 6, '2026-06-02T09:00:00Z',
  array['freelance time tracking','freelance invoicing','get paid faster','timesheet to invoice'],
  null,
  jsonb_build_object(
    'title_translations', jsonb_build_object(
      'en', 'From logged hours to paid invoices: the freelance billing workflow',
      'fr', 'Des heures saisies aux factures payées : le flux de facturation freelance'),
    'excerpt_translations', jsonb_build_object(
      'en', 'A clear, five-step workflow that turns tracked time into approved, funded and settled invoices — without spreadsheets.',
      'fr', 'Un flux clair en cinq étapes qui transforme le temps suivi en factures approuvées, financées et réglées — sans tableur.'),
    'description_translations', jsonb_build_object(
      'en', 'Learn the five-step freelance billing workflow — log hours, approve, convert to a day rate, invoice and settle — and get paid faster with Chrono.',
      'fr', 'Découvrez le flux de facturation freelance en cinq étapes — saisir, approuver, convertir en TJM, facturer et régler — et soyez payé plus vite avec Chrono.'),
    'content_translations', jsonb_build_object(
      'en', E'# From logged hours to paid invoices\n\nGetting paid as a freelancer should be the easy part. Yet most teams still stitch together spreadsheets, screenshots and email threads to turn hours into money. Here is the five-step workflow Chrono automates.\n\n## 1. Log time against a project\n\nEvery billable hour starts as a **time entry**: a date, a duration and a short description, attached to a project. No live timer to babysit — log the day when it suits you.\n\n## 2. Approve the work\n\nA manager reviews pending entries and **approves or rejects** each one, with a reason. Only approved, billable time can ever be invoiced, so the numbers everyone bills from are trusted.\n\n## 3. Convert hours to a day rate\n\nChrono converts approved minutes into **days** using the project''s hours-per-day, then multiplies by the freelancer''s **TJM** (day rate). Hours in, euros out — the same maths on every screen.\n\n## 4. Generate and submit the invoice\n\nAt month end the freelancer generates a monthly invoice: worked days × TJM, plus any credit carried forward from a previous shortfall. One click to submit.\n\n## 5. Settle against real funding\n\nInvoices are paid from **recognized revenue**, not thin air. Chrono settles them FIFO against the project''s funding pool and carries any shortfall forward — so cash-flow reality is baked in.\n\n> The result: less admin, fewer disputes, and freelancers paid on time.',
      'fr', E'# Des heures saisies aux factures payées\n\nÊtre payé en freelance devrait être la partie facile. Pourtant, la plupart des équipes jonglent encore avec tableurs, captures d''écran et fils d''e-mails pour transformer des heures en argent. Voici le flux en cinq étapes que Chrono automatise.\n\n## 1. Saisir le temps sur un projet\n\nChaque heure facturable commence par une **saisie de temps** : une date, une durée et une courte description, rattachées à un projet. Pas de minuteur à surveiller — saisissez la journée quand cela vous convient.\n\n## 2. Approuver le travail\n\nUn manager examine les saisies en attente et **approuve ou refuse** chacune, avec un motif. Seul le temps approuvé et facturable peut être facturé : tout le monde facture sur des chiffres fiables.\n\n## 3. Convertir les heures en TJM\n\nChrono convertit les minutes approuvées en **jours** via les heures-par-jour du projet, puis multiplie par le **TJM** du freelance. Des heures en entrée, des euros en sortie — le même calcul partout.\n\n## 4. Générer et soumettre la facture\n\nEn fin de mois, le freelance génère une facture mensuelle : jours travaillés × TJM, plus tout crédit reporté d''un mois précédent. Un clic pour soumettre.\n\n## 5. Régler sur un financement réel\n\nLes factures sont payées à partir du **chiffre d''affaires reconnu**, pas du vide. Chrono les règle en FIFO sur le pool de financement du projet et reporte tout manque — la réalité de trésorerie est intégrée.\n\n> Résultat : moins d''administratif, moins de litiges, et des freelances payés à temps.')
  )
),
(
  'tjm-day-rate-pricing-freelance-work',
  'published', 'Chrono', 5, '2026-06-16T09:00:00Z',
  array['TJM','day rate','freelance pricing','tarif journalier','how to price freelance'],
  null,
  jsonb_build_object(
    'title_translations', jsonb_build_object(
      'en', 'TJM explained: how to price freelance work by the day',
      'fr', 'Le TJM expliqué : comment tarifer une prestation freelance à la journée'),
    'excerpt_translations', jsonb_build_object(
      'en', 'Day rates (TJM) are the backbone of freelance pricing in Europe. Here is how they work, how to set yours, and how a client day rate differs.',
      'fr', 'Le TJM est la colonne vertébrale de la tarification freelance en Europe. Voici comment il fonctionne, comment fixer le vôtre, et en quoi le tarif client diffère.'),
    'description_translations', jsonb_build_object(
      'en', 'What is a TJM (freelance day rate), how to calculate yours from a target income, and how the client day rate drives project margin.',
      'fr', 'Qu''est-ce qu''un TJM, comment le calculer à partir d''un revenu cible, et comment le tarif client détermine la marge du projet.'),
    'content_translations', jsonb_build_object(
      'en', E'# TJM explained\n\n**TJM** — *taux journalier moyen*, or day rate — is how most European freelancers and the companies who hire them price work. Instead of billing raw hours, you agree a rate per working day and bill the days delivered.\n\n## Why day rates win\n\n- **Predictable**: a client budgets in days, not fuzzy hours.\n- **Fair**: a day is a day, whether the task took six focused hours or eight.\n- **Simple to settle**: days × rate is trivial to audit.\n\n## Setting your TJM\n\nStart from a target annual income, add costs (tools, insurance, time off, admin) and divide by realistic *billable* days — rarely more than ~200 a year. The result is your floor; position above it for scarce skills.\n\n## Client rate vs your rate\n\nOn many projects the company bills the **client** a higher day rate than it pays the **freelancer**. That spread — client rate minus TJM — is the project **margin**. Chrono tracks both: your TJM funds your invoice, the client rate feeds recognized revenue, and the difference is margin you can see per project.\n\n> Price by the day, track by the day, get paid by the day.',
      'fr', E'# Le TJM expliqué\n\nLe **TJM** — taux journalier moyen — est la façon dont la plupart des freelances européens et les entreprises qui les recrutent tarifent le travail. Plutôt que de facturer des heures brutes, on convient d''un tarif par jour travaillé et l''on facture les jours livrés.\n\n## Pourquoi le tarif journalier s''impose\n\n- **Prévisible** : le client budgète en jours, pas en heures floues.\n- **Équitable** : un jour est un jour, que la tâche ait pris six heures concentrées ou huit.\n- **Simple à régler** : jours × tarif s''audite en un instant.\n\n## Fixer votre TJM\n\nPartez d''un revenu annuel cible, ajoutez les coûts (outils, assurance, congés, administratif) et divisez par des jours *facturables* réalistes — rarement plus de ~200 par an. Le résultat est votre plancher ; positionnez-vous au-dessus pour des compétences rares.\n\n## Tarif client vs votre tarif\n\nSur de nombreux projets, l''entreprise facture au **client** un tarif journalier supérieur à ce qu''elle verse au **freelance**. Cet écart — tarif client moins TJM — est la **marge** du projet. Chrono suit les deux : votre TJM finance votre facture, le tarif client alimente le chiffre d''affaires reconnu, et la différence est une marge visible par projet.\n\n> Tarifez à la journée, suivez à la journée, soyez payé à la journée.')
  )
),
(
  'recognized-revenue-referrals-fifo-settlement',
  'published', 'Chrono', 7, '2026-06-30T09:00:00Z',
  array['recognized revenue','referral split','FIFO settlement','agency finance','funding pool'],
  null,
  jsonb_build_object(
    'title_translations', jsonb_build_object(
      'en', 'Recognized revenue, referral splits and FIFO settlement, explained',
      'fr', 'Chiffre d''affaires reconnu, commissions d''apport et règlement FIFO, expliqués'),
    'excerpt_translations', jsonb_build_object(
      'en', 'How a project actually funds freelancer invoices: recognized revenue, a referrer''s first claim, and paying invoices in order until the money runs out.',
      'fr', 'Comment un projet finance réellement les factures : chiffre d''affaires reconnu, première part de l''apporteur, et paiement des factures dans l''ordre jusqu''à épuisement.'),
    'description_translations', jsonb_build_object(
      'en', 'Understand recognized revenue, referral first-claim payouts, and FIFO invoice settlement with carry-forward — the money model behind Chrono.',
      'fr', 'Comprenez le chiffre d''affaires reconnu, la première part des apporteurs et le règlement FIFO avec report — le modèle financier de Chrono.'),
    'content_translations', jsonb_build_object(
      'en', E'# Recognized revenue, referrals and FIFO settlement\n\nPaying freelancers fairly means paying them from money that actually exists. Chrono models this with three ideas.\n\n## Recognized revenue is the pool\n\nEach month a project **recognizes revenue** from its sources: a fixed monthly retainer, a client day rate on approved time, or a self-billed amount. That recognized revenue *is* the funding pool — no separate manual budget.\n\n## Referrers get a first claim\n\nIf a freelancer brought the client, they earn a **referral percentage** of that month''s revenue, paid off the top before anyone else. It is always funded, because it is a fraction of the same month''s revenue.\n\n## Invoices settle FIFO, with carry-forward\n\nWhat is left — revenue minus referrals — pays freelancer invoices in **submission order (FIFO)**. If the pool runs dry, the remaining invoices are *partially paid* and the shortfall **carries forward** to next month, to be paid once revenue allows.\n\n## Why it matters\n\nThis mirrors how agencies really work: you cannot pay out more than a project earns. Margin — revenue minus referral minus freelancer cost — stays honest, and everyone can see exactly why an invoice was paid, part-paid, or carried.\n\n> Fund from reality, pay in order, carry the rest.',
      'fr', E'# Chiffre d''affaires reconnu, apports et règlement FIFO\n\nPayer les freelances équitablement, c''est les payer avec de l''argent qui existe vraiment. Chrono modélise cela avec trois idées.\n\n## Le chiffre d''affaires reconnu est le pool\n\nChaque mois, un projet **reconnaît un chiffre d''affaires** à partir de ses sources : un forfait mensuel fixe, un tarif client sur le temps approuvé, ou un montant auto-facturé. Ce chiffre reconnu *est* le pool de financement — pas de budget manuel séparé.\n\n## Les apporteurs ont une première part\n\nSi un freelance a amené le client, il perçoit un **pourcentage d''apport** sur le chiffre du mois, prélevé en premier. Il est toujours financé, car c''est une fraction du chiffre du même mois.\n\n## Les factures se règlent en FIFO, avec report\n\nCe qui reste — chiffre moins apports — paie les factures dans l''**ordre de soumission (FIFO)**. Si le pool est épuisé, les factures restantes sont *partiellement payées* et le manque **se reporte** au mois suivant, réglé dès que le chiffre le permet.\n\n## Pourquoi c''est important\n\nCela reflète le fonctionnement réel des agences : on ne peut pas verser plus qu''un projet ne gagne. La marge — chiffre moins apport moins coût freelance — reste honnête, et chacun voit exactement pourquoi une facture a été payée, partiellement payée ou reportée.\n\n> Financez à partir du réel, payez dans l''ordre, reportez le reste.')
  )
);
