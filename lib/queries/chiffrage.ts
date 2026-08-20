// Module serveur uniquement : ne jamais importer depuis un composant client.
import { prisma } from "@/lib/prisma"
import { nb } from "@/lib/utils"
import { calculerChiffrage, type ResultatChiffrage } from "@/lib/metier/chiffrage"

export type PosteVue = {
  id: string
  lotId: string
  ordre: number
  designation: string
  description: string | null
  unite: string
  quantite: number
  prixUnitaire: number
  coutMateriaux: number
  coutMainOeuvre: number
  coutSousTraitance: number
  coutMateriel: number
  coutTransport: number
  totalHT: number
  coutDirect: number
}

export type LotVue = {
  id: string
  code: string
  nom: string
  categorie: string
  ordre: number
  statut: string
  sousTraite: boolean
  descriptif: string | null
  postes: PosteVue[]
}

export type ChiffrageVue = {
  estimateId: string
  nom: string
  scenario: string
  version: number
  retenu: boolean
  genereParIa: boolean
  commentaire: string | null
  lots: LotVue[]
  resultat: ResultatChiffrage
  scenarios: {
    id: string
    nom: string
    scenario: string
    retenu: boolean
    montantHT: number
    version: number
  }[]
  params: {
    margeCible: number
    tauxFraisChantier: number
    tauxFraisGeneraux: number
    tauxTva: number
  }
}

export async function chiffrageProjet(
  projectId: string,
  organizationId: string,
  estimateId?: string
): Promise<ChiffrageVue | null> {
  const projet = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: {
      margeCible: true,
      tauxFraisChantier: true,
      tauxFraisGeneraux: true,
      tauxTva: true,
    },
  })
  if (!projet) return null

  const params = {
    margeCible: nb(projet.margeCible),
    tauxFraisChantier: nb(projet.tauxFraisChantier),
    tauxFraisGeneraux: nb(projet.tauxFraisGeneraux),
    tauxTva: nb(projet.tauxTva),
  }

  const tous = await prisma.estimate.findMany({
    where: { projectId },
    orderBy: [{ retenu: "desc" }, { updatedAt: "desc" }],
    include: { items: { orderBy: { ordre: "asc" } } },
  })
  if (tous.length === 0) return null

  const courant = (estimateId ? tous.find((e) => e.id === estimateId) : undefined) ?? tous[0]

  const lots = await prisma.lot.findMany({
    where: { projectId },
    orderBy: { ordre: "asc" },
  })

  const postesParLot = new Map<string, PosteVue[]>()
  for (const item of courant.items) {
    const quantite = nb(item.quantite)
    const coutUnitaire =
      nb(item.coutMateriaux) +
      nb(item.coutMainOeuvre) +
      nb(item.coutSousTraitance) +
      nb(item.coutMateriel) +
      nb(item.coutTransport)

    const poste: PosteVue = {
      id: item.id,
      lotId: item.lotId,
      ordre: item.ordre,
      designation: item.designation,
      description: item.description,
      unite: item.unite,
      quantite,
      prixUnitaire: nb(item.prixUnitaire),
      coutMateriaux: nb(item.coutMateriaux),
      coutMainOeuvre: nb(item.coutMainOeuvre),
      coutSousTraitance: nb(item.coutSousTraitance),
      coutMateriel: nb(item.coutMateriel),
      coutTransport: nb(item.coutTransport),
      totalHT: quantite * nb(item.prixUnitaire),
      coutDirect:
        coutUnitaire > 0
          ? quantite * coutUnitaire
          : quantite * nb(item.prixUnitaire) * (1 - params.margeCible / 100),
    }

    const liste = postesParLot.get(item.lotId) ?? []
    liste.push(poste)
    postesParLot.set(item.lotId, liste)
  }

  const lotsVue: LotVue[] = lots.map((l) => ({
    id: l.id,
    code: l.code,
    nom: l.nom,
    categorie: l.categorie,
    ordre: l.ordre,
    statut: l.statut,
    sousTraite: l.sousTraite,
    descriptif: l.descriptif,
    postes: postesParLot.get(l.id) ?? [],
  }))

  const resultat = calculerChiffrage(
    lotsVue.map((l) => ({
      id: l.id,
      code: l.code,
      nom: l.nom,
      categorie: l.categorie,
      sousTraite: l.sousTraite,
    })),
    courant.items.map((i) => ({
      id: i.id,
      lotId: i.lotId,
      designation: i.designation,
      unite: i.unite,
      quantite: nb(i.quantite),
      prixUnitaire: nb(i.prixUnitaire),
      coutMateriaux: nb(i.coutMateriaux),
      coutMainOeuvre: nb(i.coutMainOeuvre),
      coutSousTraitance: nb(i.coutSousTraitance),
      coutMateriel: nb(i.coutMateriel),
      coutTransport: nb(i.coutTransport),
    })),
    params
  )

  return {
    estimateId: courant.id,
    nom: courant.nom,
    scenario: courant.scenario,
    version: courant.version,
    retenu: courant.retenu,
    genereParIa: courant.genereParIa,
    commentaire: courant.commentaire,
    lots: lotsVue,
    resultat,
    scenarios: tous.map((e) => ({
      id: e.id,
      nom: e.nom,
      scenario: e.scenario,
      retenu: e.retenu,
      version: e.version,
      montantHT: e.items.reduce((s, i) => s + nb(i.quantite) * nb(i.prixUnitaire), 0),
    })),
    params,
  }
}

/** Suggestions de prix issues de la bibliotheque, pour l'autocompletion. */
export async function suggestionsPrix(organizationId: string, categorie?: string) {
  const items = await prisma.priceItem.findMany({
    where: {
      organizationId,
      actif: true,
      ...(categorie ? { categorie: categorie as never } : {}),
    },
    select: {
      id: true,
      code: true,
      designation: true,
      categorie: true,
      unite: true,
      prixReference: true,
      coutReference: true,
      prixMin: true,
      prixMoyen: true,
      prixMax: true,
    },
    orderBy: { designation: "asc" },
    take: 400,
  })

  return items.map((i) => ({
    id: i.id,
    code: i.code,
    designation: i.designation,
    categorie: i.categorie,
    unite: i.unite,
    prix: nb(i.prixReference),
    cout: nb(i.coutReference),
    prixMin: i.prixMin ? nb(i.prixMin) : null,
    prixMoyen: i.prixMoyen ? nb(i.prixMoyen) : null,
    prixMax: i.prixMax ? nb(i.prixMax) : null,
  }))
}

export type SuggestionPrix = Awaited<ReturnType<typeof suggestionsPrix>>[number]
